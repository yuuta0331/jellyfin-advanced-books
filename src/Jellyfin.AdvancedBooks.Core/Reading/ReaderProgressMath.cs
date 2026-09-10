namespace Jellyfin.AdvancedBooks.Core.Reading;

/// <summary>
/// Converts comic page positions to Jellyfin playback-position ticks.
/// Jellyfin Web's built-in ComicsPlayer exposes its page index as milliseconds,
/// so playbackmanager persists one page as 10,000 ticks.
/// </summary>
public static class ReaderProgressMath
{
    /// <summary>
    /// Number of Jellyfin playback ticks used for one comic page index.
    /// </summary>
    public const long TicksPerPage = 10_000;

    /// <summary>
    /// Converts a zero-based page index to Jellyfin playback ticks.
    /// </summary>
    /// <param name="pageIndex">Zero-based page index.</param>
    /// <returns>Playback position ticks compatible with Jellyfin's ComicsPlayer.</returns>
    public static long ToPlaybackPositionTicks(int pageIndex)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(pageIndex);
        return checked((long)pageIndex * TicksPerPage);
    }

    /// <summary>
    /// Converts Jellyfin playback ticks to a valid zero-based page index.
    /// </summary>
    /// <param name="playbackPositionTicks">Stored Jellyfin playback position.</param>
    /// <param name="pageCount">Number of pages in the book.</param>
    /// <returns>A page index clamped to the available page range.</returns>
    public static int FromPlaybackPositionTicks(long playbackPositionTicks, int pageCount)
    {
        if (pageCount <= 0 || playbackPositionTicks <= 0)
        {
            return 0;
        }

        var pageIndex = playbackPositionTicks / TicksPerPage;
        return (int)Math.Min(pageCount - 1L, pageIndex);
    }

    /// <summary>
    /// Gets the percentage of the book reached by the supplied page.
    /// </summary>
    public static double GetPercentage(int pageIndex, int pageCount)
    {
        if (pageCount <= 0)
        {
            return 0;
        }

        var clamped = Math.Clamp(pageIndex, 0, pageCount - 1);
        return (clamped + 1) * 100d / pageCount;
    }

    /// <summary>
    /// Returns whether the supplied page is the final page of the book.
    /// </summary>
    public static bool IsComplete(int pageIndex, int pageCount)
        => pageCount > 0 && pageIndex >= pageCount - 1;
}
