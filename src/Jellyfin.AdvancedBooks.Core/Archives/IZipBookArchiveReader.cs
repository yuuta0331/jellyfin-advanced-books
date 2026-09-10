namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Reads image pages from CBZ/ZIP archives without extracting them to disk.
/// </summary>
public interface IZipBookArchiveReader
{
    /// <summary>
    /// Returns whether the path has a supported archive extension.
    /// </summary>
    /// <param name="path">Archive path.</param>
    /// <returns><see langword="true"/> when the path is supported.</returns>
    bool CanRead(string path);

    /// <summary>
    /// Reads validated archive/page metadata.
    /// </summary>
    /// <param name="path">Archive path.</param>
    /// <returns>Archive metadata.</returns>
    ArchiveBookInfo GetBookInfo(string path);

    /// <summary>
    /// Opens one validated page by natural-order index.
    /// </summary>
    /// <param name="path">Archive path.</param>
    /// <param name="pageIndex">Zero-based page index.</param>
    /// <returns>A lease that must be disposed after streaming.</returns>
    ArchivePageLease OpenPage(string path, int pageIndex);
}
