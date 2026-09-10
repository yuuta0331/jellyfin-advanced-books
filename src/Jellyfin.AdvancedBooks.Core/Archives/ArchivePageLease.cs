using System.IO.Compression;

namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Owns an open archive page stream and the archive resources required to keep it readable.
/// </summary>
public sealed class ArchivePageLease : IDisposable
{
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
        Content = content;
        _archive = archive;
        _archiveStream = archiveStream;
    }

    /// <summary>
    /// Gets metadata for the leased page.
    /// </summary>
    public ArchivePage Page { get; }

    /// <summary>
    /// Gets the readable decompressed page stream.
    /// </summary>
    public Stream Content { get; }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        Content.Dispose();
        _archive.Dispose();
        _archiveStream.Dispose();
    }
}
