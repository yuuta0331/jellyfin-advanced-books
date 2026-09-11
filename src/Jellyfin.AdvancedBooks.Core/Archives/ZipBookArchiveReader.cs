using System.IO.Compression;

namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Safe CBZ/ZIP page reader backed by <see cref="ZipArchive"/>.
/// </summary>
public sealed class ZipBookArchiveReader : IZipBookArchiveReader
{
    private static readonly IReadOnlyDictionary<string, string> _imageContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".avif"] = "image/avif",
            [".bmp"] = "image/bmp",
            [".gif"] = "image/gif",
            [".jpeg"] = "image/jpeg",
            [".jpg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp"
        };

    private readonly ZipArchiveSafetyOptions _options;

    /// <summary>
    /// Initializes a new instance of the <see cref="ZipBookArchiveReader"/> class.
    /// </summary>
    public ZipBookArchiveReader()
        : this(ZipArchiveSafetyOptions.Default)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ZipBookArchiveReader"/> class.
    /// </summary>
    /// <param name="options">Defensive archive limits.</param>
    public ZipBookArchiveReader(ZipArchiveSafetyOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        ValidateOptions(options);
        _options = options;
    }

    /// <inheritdoc />
    public bool CanRead(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        var extension = Path.GetExtension(path);
        return extension.Equals(".cbz", StringComparison.OrdinalIgnoreCase)
            || extension.Equals(".zip", StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public ArchiveBookInfo GetBookInfo(string path)
    {
        EnsureReadablePath(path);
        var fileInfo = new FileInfo(path);

        using var stream = OpenArchiveFile(path);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
        var pages = GetValidatedPages(archive);

        return new ArchiveBookInfo(
            Path.GetExtension(path).TrimStart('.').ToUpperInvariant(),
            fileInfo.Length,
            fileInfo.LastWriteTimeUtc,
            pages);
    }

    /// <inheritdoc />
    public ArchivePageLease OpenPage(string path, int pageIndex)
    {
        if (pageIndex < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(pageIndex));
        }

        EnsureReadablePath(path);

        FileStream? stream = null;
        ZipArchive? archive = null;
        Stream? content = null;

        try
        {
            stream = OpenArchiveFile(path);
            archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
            var pageEntries = GetValidatedPageEntries(archive);
            if (pageIndex >= pageEntries.Count)
            {
                throw new ArgumentOutOfRangeException(nameof(pageIndex));
            }

            var selected = pageEntries[pageIndex];
            content = selected.Entry.Open();
            return new ArchivePageLease(selected.Page, content, archive, stream);
        }
        catch
        {
            content?.Dispose();
            archive?.Dispose();
            stream?.Dispose();
            throw;
        }
    }

    private static FileStream OpenArchiveFile(string path)
        => new(path, FileMode.Open, FileAccess.Read, FileShare.Read);

    private IReadOnlyList<ArchivePage> GetValidatedPages(ZipArchive archive)
        => GetValidatedPageEntries(archive).Select(static item => item.Page).ToArray();

    private IReadOnlyList<(ZipArchiveEntry Entry, ArchivePage Page)> GetValidatedPageEntries(ZipArchive archive)
    {
        if (archive.Entries.Count > _options.MaxArchiveEntries)
        {
            throw new ArchiveSafetyException(
                $"Archive contains {archive.Entries.Count} entries; limit is {_options.MaxArchiveEntries}.");
        }

        var imageEntries = archive.Entries
            .Where(static entry => !string.IsNullOrEmpty(entry.Name))
            .Where(static entry => !IsIgnoredArchiveEntry(entry.FullName))
            .Where(entry => TryGetImageContentType(entry.FullName, out _))
            .OrderBy(static entry => NormalizeEntryName(entry.FullName), NaturalStringComparer.Instance)
            .ToArray();

        if (imageEntries.Length > _options.MaxPages)
        {
            throw new ArchiveSafetyException(
                $"Archive contains {imageEntries.Length} image pages; limit is {_options.MaxPages}.");
        }

        long totalUncompressedBytes = 0;
        var pages = new (ZipArchiveEntry Entry, ArchivePage Page)[imageEntries.Length];

        for (var index = 0; index < imageEntries.Length; index++)
        {
            var entry = imageEntries[index];
            ValidateEntryPath(entry.FullName);
            ValidateEntrySize(entry);

            if (entry.Length > _options.MaxTotalUncompressedPageBytes - totalUncompressedBytes)
            {
                throw new ArchiveSafetyException(
                    $"Archive image data exceeds the {_options.MaxTotalUncompressedPageBytes}-byte total limit.");
            }

            totalUncompressedBytes += entry.Length;
            _ = TryGetImageContentType(entry.FullName, out var contentType);
            pages[index] = (
                entry,
                new ArchivePage(index, NormalizeEntryName(entry.FullName), entry.Length, entry.CompressedLength, contentType!));
        }

        return pages;
    }

    private void ValidateEntrySize(ZipArchiveEntry entry)
    {
        if (entry.Length > _options.MaxUncompressedPageBytes)
        {
            throw new ArchiveSafetyException(
                $"Archive page '{entry.FullName}' is {entry.Length} bytes; per-page limit is {_options.MaxUncompressedPageBytes}.");
        }

        if (entry.Length == 0)
        {
            return;
        }

        if (entry.CompressedLength <= 0)
        {
            throw new ArchiveSafetyException($"Archive page '{entry.FullName}' has an invalid compressed length.");
        }

        var compressionRatio = (double)entry.Length / entry.CompressedLength;
        if (compressionRatio > _options.MaxCompressionRatio)
        {
            throw new ArchiveSafetyException(
                $"Archive page '{entry.FullName}' has compression ratio {compressionRatio:F1}; limit is {_options.MaxCompressionRatio:F1}.");
        }
    }

    private void EnsureReadablePath(string path)
    {
        if (!CanRead(path))
        {
            throw new NotSupportedException("Only CBZ and ZIP archives are supported by this reader.");
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException("Book archive does not exist.", path);
        }
    }

    private static void ValidateEntryPath(string path)
    {
        if (path.IndexOf('\0') >= 0)
        {
            throw new ArchiveSafetyException("Archive entry contains a NUL character.");
        }

        var normalized = NormalizeEntryName(path);
        if (normalized.StartsWith("/", StringComparison.Ordinal))
        {
            throw new ArchiveSafetyException($"Archive entry '{path}' uses an absolute path.");
        }

        foreach (var segment in normalized.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (segment.Equals("..", StringComparison.Ordinal))
            {
                throw new ArchiveSafetyException($"Archive entry '{path}' contains parent-directory traversal.");
            }
        }
    }

    private static bool TryGetImageContentType(string path, out string? contentType)
        => _imageContentTypes.TryGetValue(Path.GetExtension(path), out contentType);

    private static bool IsIgnoredArchiveEntry(string path)
    {
        var normalized = NormalizeEntryName(path);
        var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Any(static segment => segment.Equals("__MACOSX", StringComparison.OrdinalIgnoreCase))
            || (segments.Length > 0 && segments[^1].StartsWith("._", StringComparison.Ordinal));
    }

    private static string NormalizeEntryName(string value) => value.Replace('\\', '/');

    private static void ValidateOptions(ZipArchiveSafetyOptions options)
    {
        if (options.MaxArchiveEntries <= 0
            || options.MaxPages <= 0
            || options.MaxUncompressedPageBytes <= 0
            || options.MaxTotalUncompressedPageBytes <= 0
            || options.MaxCompressionRatio <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(options), "All archive safety limits must be positive.");
        }
    }
}
