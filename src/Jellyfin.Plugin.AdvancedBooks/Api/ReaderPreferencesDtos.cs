namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Per-user Advanced Reader preferences stored in Jellyfin display preferences.
/// </summary>
public sealed record ReaderPreferencesDto(
    string Layout,
    string Direction,
    string Fit,
    double Zoom,
    int SidePadding,
    int PageGap);

/// <summary>
/// Replaces the current user's Advanced Reader preferences.
/// </summary>
public sealed class UpdateReaderPreferencesRequest
{
    /// <summary>Gets or sets the reader layout.</summary>
    public string Layout { get; set; } = string.Empty;

    /// <summary>Gets or sets the paged reading direction.</summary>
    public string Direction { get; set; } = string.Empty;

    /// <summary>Gets or sets the fit mode.</summary>
    public string Fit { get; set; } = string.Empty;

    /// <summary>Gets or sets the reader zoom multiplier.</summary>
    public double Zoom { get; set; } = 1d;

    /// <summary>Gets or sets continuous-reader side padding as a percentage.</summary>
    public int SidePadding { get; set; }

    /// <summary>Gets or sets continuous-reader page gap in pixels.</summary>
    public int PageGap { get; set; }
}
