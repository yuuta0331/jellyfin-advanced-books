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

    /// <summary>
    /// Gets or sets an optional explicit completion flag. Reaching the final page
    /// always marks the book complete even when this value is omitted or false.
    /// </summary>
    public bool? Completed { get; set; }
}
