namespace Jellyfin.AdvancedBooks.Core.Reading;

/// <summary>
/// Validates and normalizes persisted Advanced Reader preferences independently of Jellyfin host types.
/// </summary>
public static class ReaderPreferenceRules
{
    /// <summary>Default reader layout.</summary>
    public const string DefaultLayout = "single";

    /// <summary>Default paged reading direction.</summary>
    public const string DefaultDirection = "rtl";

    /// <summary>Default image fit mode.</summary>
    public const string DefaultFit = "screen";

    /// <summary>Current persisted reader-preference schema version.</summary>
    public const int CurrentPreferenceSchemaVersion = 5;

    /// <summary>Default reader UI language mode.</summary>
    public const string DefaultLanguage = "auto";

    /// <summary>Default reader zoom.</summary>
    public const double DefaultZoom = 1d;

    /// <summary>Default reader background.</summary>
    public const string DefaultBackground = "black";

    /// <summary>Whether page transitions are enabled by default.</summary>
    public const bool DefaultAnimateTransitions = true;

    /// <summary>Whether touch gestures are enabled by default.</summary>
    public const bool DefaultTouchGestures = true;

    /// <summary>Whether the reader metadata header is shown by default.</summary>
    public const bool DefaultShowMetadata = true;

    /// <summary>Whether the title is shown in reader metadata by default.</summary>
    public const bool DefaultShowMetadataTitle = true;

    /// <summary>Whether authors are shown in reader metadata by default.</summary>
    public const bool DefaultShowMetadataAuthors = true;

    /// <summary>Whether series is shown in reader metadata by default.</summary>
    public const bool DefaultShowMetadataSeries = true;

    /// <summary>Whether issue/index is shown in reader metadata by default.</summary>
    public const bool DefaultShowMetadataIssue = true;

    /// <summary>Whether year is shown in reader metadata by default.</summary>
    public const bool DefaultShowMetadataYear = true;

    /// <summary>Whether overflowing reader metadata scrolls automatically by default.</summary>
    public const bool DefaultAutoScrollMetadata = true;

    /// <summary>Default continuous-reader side padding percentage.</summary>
    public const int DefaultSidePadding = 0;

    /// <summary>Default continuous-reader page gap in pixels.</summary>
    public const int DefaultPageGap = 0;

    /// <summary>Minimum persisted zoom.</summary>
    public const double MinimumZoom = 0.5d;

    /// <summary>Maximum persisted zoom.</summary>
    public const double MaximumZoom = 4d;

    /// <summary>Returns whether a layout value is supported.</summary>
    public static bool IsValidLayout(string? value)
        => value is "single" or "double" or "vertical" or "webtoon";

    /// <summary>Returns whether a reading-direction value is supported.</summary>
    public static bool IsValidDirection(string? value)
        => value is "rtl" or "ltr";

    /// <summary>Returns whether a reader UI language value is supported.</summary>
    public static bool IsValidLanguage(string? value)
        => value is "auto" or "en" or "ja" or "de" or "fr" or "es" or "zh-CN";

    /// <summary>Returns whether a fit value is supported.</summary>
    public static bool IsValidFit(string? value)
        => value is "screen" or "width" or "height" or "original";

    /// <summary>Returns whether a zoom value is finite and inside the reader's supported range.</summary>
    public static bool IsValidZoom(double value)
        => double.IsFinite(value) && value >= MinimumZoom && value <= MaximumZoom;

    /// <summary>Returns whether a reader background is supported.</summary>
    public static bool IsValidBackground(string? value)
        => value is "black" or "gray" or "white";

    /// <summary>Returns whether a continuous-reader side padding value is supported.</summary>
    public static bool IsValidSidePadding(int value)
        => value is 0 or 2 or 5 or 10 or 15 or 20;

    /// <summary>Returns whether a continuous-reader page gap value is supported.</summary>
    public static bool IsValidPageGap(int value)
        => value is 0 or 4 or 8 or 12 or 16 or 24 or 32;

    /// <summary>Normalizes a stored layout, falling back when stale or unknown.</summary>
    public static string NormalizeLayout(string? value)
        => IsValidLayout(value) ? value! : DefaultLayout;

    /// <summary>Normalizes a stored direction, falling back when stale or unknown.</summary>
    public static string NormalizeDirection(string? value)
        => IsValidDirection(value) ? value! : DefaultDirection;

    /// <summary>Normalizes a stored reader UI language, falling back to automatic detection.</summary>
    public static string NormalizeLanguage(string? value)
        => IsValidLanguage(value) ? value! : DefaultLanguage;

    /// <summary>Normalizes a stored fit mode, falling back when stale or unknown.</summary>
    public static string NormalizeFit(string? value)
        => IsValidFit(value) ? value! : DefaultFit;

    /// <summary>
    /// Normalizes a stored fit mode and migrates legacy schema values.
    /// Early builds could persist Height as the apparent default; schema v2+
    /// treats Height as an explicit user choice and preserves it.
    /// </summary>
    public static string NormalizeStoredFit(string? value, int schemaVersion)
    {
        var normalized = NormalizeFit(value);
        return schemaVersion < 2 && normalized == "height"
            ? DefaultFit
            : normalized;
    }

    /// <summary>Normalizes a reader background, falling back when stale or unknown.</summary>
    public static string NormalizeBackground(string? value)
        => IsValidBackground(value) ? value! : DefaultBackground;

    /// <summary>Normalizes side padding, falling back when stale or unknown.</summary>
    public static int NormalizeSidePadding(int value)
        => IsValidSidePadding(value) ? value : DefaultSidePadding;

    /// <summary>Normalizes page gap, falling back when stale or unknown.</summary>
    public static int NormalizePageGap(int value)
        => IsValidPageGap(value) ? value : DefaultPageGap;

    /// <summary>
    /// Normalizes zoom to the 5-percent reader grid.
    /// Invalid values fall back to 100 percent.
    /// </summary>
    public static double NormalizeZoom(double value)
    {
        if (!IsValidZoom(value))
        {
            return DefaultZoom;
        }

        return Math.Clamp(Math.Round(value * 20d, MidpointRounding.AwayFromZero) / 20d, MinimumZoom, MaximumZoom);
    }
}
