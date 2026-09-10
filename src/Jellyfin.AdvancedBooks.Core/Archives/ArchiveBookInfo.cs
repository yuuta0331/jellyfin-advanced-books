namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Safe, path-free metadata exposed for an archive-backed book.
/// </summary>
public sealed record ArchiveBookInfo(
    string Format,
    long ArchiveSize,
    DateTimeOffset LastModifiedUtc,
    IReadOnlyList<ArchivePage> Pages);
