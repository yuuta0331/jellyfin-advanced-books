namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Per-user Advanced Reader preferences stored in Jellyfin display preferences.
/// </summary>
public sealed record ReaderPreferencesDto(
    string Layout,
    string Direction,
    string Fit,
    double Zoom);

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

    /// <summary>Gets or sets the paged zoom multiplier.</summary>
    public double Zoom { get; set; } = 1d;
}
