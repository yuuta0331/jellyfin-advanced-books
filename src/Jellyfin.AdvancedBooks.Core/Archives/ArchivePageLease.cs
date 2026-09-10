using System.Buffers;
using System.IO.Compression;

namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Owns an open archive page stream and the archive resources required to keep it readable.
/// </summary>
public sealed class ArchivePageLease : IDisposable
{
    private const int CopyBufferSize = 81920;
    private readonly Stream _content;
    private readonly ZipArchive _archive;
    private readonly Stream _archiveStream;
    private bool _disposed;

    internal ArchivePageLease(
        ArchivePage page,
        Stream content,
        ZipArchive archive,
        Stream archiveStream)
    {
        Page = page;
        _content = content;
        _archive = archive;
        _archiveStream = archiveStream;
    }

    /// <summary>
    /// Gets metadata for the leased page.
    /// </summary>
    public ArchivePage Page { get; }

    /// <summary>
    /// Copies the page while enforcing the validated uncompressed length at read time.
    /// </summary>
    /// <param name="destination">Destination stream.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes after the validated page has been copied.</returns>
    public async Task CopyToAsync(Stream destination, CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(destination);

        var buffer = ArrayPool<byte>.Shared.Rent(CopyBufferSize);
        try
        {
            var remaining = Page.Length;
            while (remaining > 0)
            {
                var requested = (int)Math.Min(buffer.Length, remaining);
                var read = await _content
                    .ReadAsync(buffer.AsMemory(0, requested), cancellationToken)
                    .ConfigureAwait(false);

                if (read == 0)
                {
                    throw new InvalidDataException(
                        $"Archive page '{Page.Name}' ended before its declared uncompressed length.");
                }

                await destination
                    .WriteAsync(buffer.AsMemory(0, read), cancellationToken)
                    .ConfigureAwait(false);
                remaining -= read;
            }

            var extra = await _content
                .ReadAsync(buffer.AsMemory(0, 1), cancellationToken)
                .ConfigureAwait(false);
            if (extra != 0)
            {
                throw new ArchiveSafetyException(
                    $"Archive page '{Page.Name}' expanded beyond its declared uncompressed length.");
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _content.Dispose();
        _archive.Dispose();
        _archiveStream.Dispose();
    }
}
