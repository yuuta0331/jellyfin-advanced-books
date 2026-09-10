using System.Security.Cryptography;
using System.Text;
using Jellyfin.AdvancedBooks.Core.Archives;
using MediaBrowser.Controller.Drawing;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.AdvancedBooks.Services;

/// <summary>
/// Result of generating or resolving a cached reader thumbnail.
/// </summary>
public sealed record ReaderThumbnailFile(string Path, string ContentType, DateTime LastModifiedUtc);

/// <summary>
/// Creates bounded-size thumbnails for archive pages without retaining extracted source pages.
/// </summary>
public interface IReaderThumbnailService
{
    /// <summary>
    /// Gets a cached thumbnail for a page, generating it when necessary.
    /// </summary>
    Task<ReaderThumbnailFile> GetThumbnailAsync(
        Book book,
        int pageIndex,
        int maxWidth,
        CancellationToken cancellationToken);
}

/// <summary>
/// Uses Jellyfin's normal image processor to create persistent small thumbnails from temporary
/// archive-page files. Extracted full-resolution pages and image-processor intermediates are
/// removed immediately after the plugin-owned thumbnail is committed.
/// </summary>
public sealed class ReaderThumbnailService : IReaderThumbnailService
{
    private const int ThumbnailQuality = 75;
    private static readonly SemaphoreSlim GenerationSlots = new(2, 2);

    private readonly IZipBookArchiveReader _archiveReader;
    private readonly IImageProcessor _imageProcessor;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReaderThumbnailService"/> class.
    /// </summary>
    public ReaderThumbnailService(
        IZipBookArchiveReader archiveReader,
        IImageProcessor imageProcessor)
    {
        _archiveReader = archiveReader;
        _imageProcessor = imageProcessor;
    }

    /// <inheritdoc />
    public async Task<ReaderThumbnailFile> GetThumbnailAsync(
        Book book,
        int pageIndex,
        int maxWidth,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(book);

        if (string.IsNullOrWhiteSpace(book.Path) || !_archiveReader.CanRead(book.Path))
        {
            throw new NotSupportedException("The book is not backed by a supported archive.");
        }

        var info = _archiveReader.GetBookInfo(book.Path);
        if (pageIndex < 0 || pageIndex >= info.Pages.Count)
        {
            throw new ArgumentOutOfRangeException(nameof(pageIndex));
        }

        var plugin = Plugin.Instance
            ?? throw new InvalidOperationException("Advanced Books plugin instance is unavailable.");
        if (string.IsNullOrWhiteSpace(plugin.DataFolderPath))
        {
            throw new InvalidOperationException("Advanced Books data directory is unavailable.");
        }

        var page = info.Pages[pageIndex];
        var cacheDirectory = Path.Combine(plugin.DataFolderPath, "reader-thumbnails", book.Id.ToString("N"));
        Directory.CreateDirectory(cacheDirectory);

        var cacheStem = BuildCacheStem(info, page, pageIndex, maxWidth);
        var existing = FindCachedFile(cacheDirectory, cacheStem);
        if (existing is not null)
        {
            return existing;
        }

        await GenerationSlots.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            existing = FindCachedFile(cacheDirectory, cacheStem);
            if (existing is not null)
            {
                return existing;
            }

            var workDirectory = Path.Combine(plugin.DataFolderPath, "reader-thumbnail-work");
            Directory.CreateDirectory(workDirectory);

            var sourceExtension = NormalizeSourceExtension(Path.GetExtension(page.Name));
            var sourcePath = Path.Combine(workDirectory, $"{Guid.NewGuid():N}{sourceExtension}");
            string? processedPath = null;
            string? temporaryTarget = null;

            try
            {
                using (var lease = _archiveReader.OpenPage(book.Path, pageIndex))
                await using (var output = new FileStream(
                    sourcePath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    bufferSize: 81920,
                    options: FileOptions.Asynchronous | FileOptions.SequentialScan))
                {
                    await lease.CopyToAsync(output, cancellationToken).ConfigureAwait(false);
                }

                var serverOutputs = _imageProcessor.GetSupportedImageOutputFormats();
                var supportedOutputs = new List<ImageFormat>(3);
                foreach (var format in serverOutputs)
                {
                    if (format is ImageFormat.Webp or ImageFormat.Jpg or ImageFormat.Png)
                    {
                        supportedOutputs.Add(format);
                    }
                }

                if (supportedOutputs.Count == 0)
                {
                    throw new ReaderThumbnailUnavailableException(
                        "Jellyfin has no enabled WebP, JPEG, or PNG image encoder for reader thumbnails.");
                }

                var sourceDate = info.LastModifiedUtc.UtcDateTime;
                File.SetLastWriteTimeUtc(sourcePath, sourceDate);

                var processing = new ImageProcessingOptions
                {
                    ItemId = book.Id,
                    Item = book,
                    Image = new ItemImageInfo
                    {
                        Path = sourcePath,
                        Type = ImageType.Primary,
                        DateModified = sourceDate
                    },
                    MaxWidth = maxWidth,
                    Quality = ThumbnailQuality,
                    SupportedOutputFormats = supportedOutputs
                };

                var processed = await _imageProcessor.ProcessImage(processing).ConfigureAwait(false);
                processedPath = processed.Path;
                if (string.Equals(processedPath, sourcePath, StringComparison.OrdinalIgnoreCase))
                {
                    throw new ReaderThumbnailUnavailableException(
                        "Jellyfin returned the full-resolution source instead of an encoded thumbnail.");
                }

                if (!File.Exists(processedPath))
                {
                    throw new ReaderThumbnailUnavailableException("Jellyfin did not produce a thumbnail file.");
                }

                var outputExtension = NormalizeOutputExtension(Path.GetExtension(processedPath));
                var targetPath = Path.Combine(cacheDirectory, cacheStem + outputExtension);
                temporaryTarget = targetPath + $".{Guid.NewGuid():N}.tmp";

                File.Copy(processedPath, temporaryTarget, overwrite: true);
                File.Move(temporaryTarget, targetPath, overwrite: true);
                temporaryTarget = null;

                RemoveSupersededFiles(cacheDirectory, pageIndex, maxWidth, targetPath);

                return new ReaderThumbnailFile(
                    targetPath,
                    GetImageContentType(outputExtension),
                    File.GetLastWriteTimeUtc(targetPath));
            }
            finally
            {
                if (!string.IsNullOrWhiteSpace(temporaryTarget))
                {
                    TryDelete(temporaryTarget);
                }

                if (!string.IsNullOrWhiteSpace(processedPath)
                    && !string.Equals(processedPath, sourcePath, StringComparison.OrdinalIgnoreCase))
                {
                    TryDelete(processedPath);
                }

                TryDelete(sourcePath);
            }
        }
        finally
        {
            GenerationSlots.Release();
        }
    }

    private static string BuildCacheStem(
        ArchiveBookInfo info,
        ArchivePage page,
        int pageIndex,
        int maxWidth)
    {
        var version = string.Create(
            System.Globalization.CultureInfo.InvariantCulture,
            $"{info.ArchiveSize}|{info.LastModifiedUtc.UtcDateTime.Ticks}|{page.Name}|{page.Length}|{page.CompressedLength}");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(version))).ToLowerInvariant()[..16];
        return $"{pageIndex:D6}-{maxWidth}-{hash}";
    }

    private static ReaderThumbnailFile? FindCachedFile(string directory, string cacheStem)
    {
        foreach (var extension in new[] { ".webp", ".jpg", ".png" })
        {
            var path = Path.Combine(directory, cacheStem + extension);
            if (File.Exists(path))
            {
                return new ReaderThumbnailFile(path, GetImageContentType(extension), File.GetLastWriteTimeUtc(path));
            }
        }

        return null;
    }

    private static void RemoveSupersededFiles(string directory, int pageIndex, int maxWidth, string keepPath)
    {
        var prefix = $"{pageIndex:D6}-{maxWidth}-";
        foreach (var path in Directory.EnumerateFiles(directory, prefix + "*"))
        {
            if (!string.Equals(path, keepPath, StringComparison.OrdinalIgnoreCase))
            {
                TryDelete(path);
            }
        }
    }

    private static string NormalizeSourceExtension(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".jpeg" => ".jpg",
            ".jpg" or ".png" or ".webp" or ".gif" or ".bmp" or ".avif" => extension.ToLowerInvariant(),
            _ => ".jpg"
        };
    }

    private static string NormalizeOutputExtension(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".jpeg" => ".jpg",
            ".jpg" or ".png" or ".webp" => extension.ToLowerInvariant(),
            _ => throw new ReaderThumbnailUnavailableException(
                $"Jellyfin produced unsupported thumbnail format '{extension}'.")
        };
    }

    private static string GetImageContentType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".webp" => "image/webp",
            ".png" => "image/png",
            _ => "image/jpeg"
        };
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Best-effort transient/cache cleanup. A later request or OS cleanup can retry.
        }
    }
}

/// <summary>
/// Raised when Jellyfin cannot generate a bounded-size thumbnail.
/// </summary>
public sealed class ReaderThumbnailUnavailableException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReaderThumbnailUnavailableException"/> class.
    /// </summary>
    public ReaderThumbnailUnavailableException(string message)
        : base(message)
    {
    }
}
