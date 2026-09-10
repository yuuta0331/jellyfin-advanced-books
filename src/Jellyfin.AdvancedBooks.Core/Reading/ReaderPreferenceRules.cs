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

    /// <summary>Default reader zoom.</summary>
    public const double DefaultZoom = 1d;

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

    /// <summary>Returns whether a fit value is supported.</summary>
    public static bool IsValidFit(string? value)
        => value is "screen" or "width" or "height" or "original";

    /// <summary>Returns whether a zoom value is finite and inside the reader's supported range.</summary>
    public static bool IsValidZoom(double value)
        => double.IsFinite(value) && value >= MinimumZoom && value <= MaximumZoom;

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

    /// <summary>Normalizes a stored fit mode, falling back when stale or unknown.</summary>
    public static string NormalizeFit(string? value)
        => IsValidFit(value) ? value! : DefaultFit;

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
