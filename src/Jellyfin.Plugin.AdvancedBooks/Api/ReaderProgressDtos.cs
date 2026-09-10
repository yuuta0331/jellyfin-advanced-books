namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Current per-user reading position for an archive-backed book.
/// </summary>
public sealed record ReaderProgressDto(
    int PageIndex,
    int PageCount,
    long PlaybackPositionTicks,
    bool Played,
    double Percentage);

/// <summary>
/// Updates the current user's reading position.
/// </summary>
public sealed class UpdateReaderProgressRequest
{
    /// <summary>
    /// Gets or sets the zero-based page index currently reached by the reader.
    /// </summary>
    public int PageIndex { get; set; }
}
