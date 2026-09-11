using Jellyfin.AdvancedBooks.Core.Archives;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Reader-safe archive and Jellyfin metadata for one book.
/// </summary>
public sealed record ReaderBookInfoDto(
    string Format,
    long ArchiveSize,
    DateTimeOffset LastModifiedUtc,
    IReadOnlyList<ArchivePage> Pages,
    string Title,
    string? OriginalTitle,
    string? SeriesName,
    int? IndexNumber,
    int? ProductionYear,
    IReadOnlyList<string> Authors);
