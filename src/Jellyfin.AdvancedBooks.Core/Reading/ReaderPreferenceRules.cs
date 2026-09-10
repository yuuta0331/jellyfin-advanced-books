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

    /// <summary>Default paged zoom.</summary>
    public const double DefaultZoom = 1d;

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

    /// <summary>Normalizes a stored layout, falling back when stale or unknown.</summary>
    public static string NormalizeLayout(string? value)
        => IsValidLayout(value) ? value! : DefaultLayout;

    /// <summary>Normalizes a stored direction, falling back when stale or unknown.</summary>
    public static string NormalizeDirection(string? value)
        => IsValidDirection(value) ? value! : DefaultDirection;

    /// <summary>Normalizes a stored fit mode, falling back when stale or unknown.</summary>
    public static string NormalizeFit(string? value)
        => IsValidFit(value) ? value! : DefaultFit;

    /// <summary>
    /// Normalizes zoom to the 5-percent grid reachable by the current 15/25-percent reader controls.
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
