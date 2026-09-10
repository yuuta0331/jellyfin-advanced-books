namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Metadata for one readable image page inside a comic archive.
/// </summary>
public sealed record ArchivePage(
    int Index,
    string Name,
    long Length,
    long CompressedLength,
    string ContentType);
