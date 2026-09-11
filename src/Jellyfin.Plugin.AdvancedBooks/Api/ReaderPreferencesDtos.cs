using Jellyfin.AdvancedBooks.Core.Reading;

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
    int PageGap,
    string Background,
    bool AnimateTransitions,
    bool TouchGestures,
    bool ShowMetadata,
    bool ShowMetadataTitle,
    bool ShowMetadataAuthors,
    bool ShowMetadataSeries,
    bool ShowMetadataIssue,
    bool ShowMetadataYear,
    bool AutoScrollMetadata);

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

    /// <summary>Gets or sets the reader background.</summary>
    public string Background { get; set; } = ReaderPreferenceRules.DefaultBackground;

    /// <summary>Gets or sets whether paged transitions are animated.</summary>
    public bool AnimateTransitions { get; set; } = ReaderPreferenceRules.DefaultAnimateTransitions;

    /// <summary>Gets or sets whether touch gestures are enabled.</summary>
    public bool TouchGestures { get; set; } = ReaderPreferenceRules.DefaultTouchGestures;

    /// <summary>Gets or sets whether reader metadata is shown.</summary>
    public bool ShowMetadata { get; set; } = ReaderPreferenceRules.DefaultShowMetadata;

    /// <summary>Gets or sets whether the title is shown in reader metadata.</summary>
    public bool ShowMetadataTitle { get; set; } = ReaderPreferenceRules.DefaultShowMetadataTitle;

    /// <summary>Gets or sets whether authors are shown in reader metadata.</summary>
    public bool ShowMetadataAuthors { get; set; } = ReaderPreferenceRules.DefaultShowMetadataAuthors;

    /// <summary>Gets or sets whether series is shown in reader metadata.</summary>
    public bool ShowMetadataSeries { get; set; } = ReaderPreferenceRules.DefaultShowMetadataSeries;

    /// <summary>Gets or sets whether issue/index is shown in reader metadata.</summary>
    public bool ShowMetadataIssue { get; set; } = ReaderPreferenceRules.DefaultShowMetadataIssue;

    /// <summary>Gets or sets whether year is shown in reader metadata.</summary>
    public bool ShowMetadataYear { get; set; } = ReaderPreferenceRules.DefaultShowMetadataYear;

    /// <summary>Gets or sets whether overflowing reader metadata scrolls automatically.</summary>
    public bool AutoScrollMetadata { get; set; } = ReaderPreferenceRules.DefaultAutoScrollMetadata;
}
