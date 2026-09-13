using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.AdvancedBooks.Configuration;

/// <summary>
/// Controls how a One-Shot is represented in Jellyfin's book model.
/// </summary>
public enum OneShotSeriesMode
{
    /// <summary>
    /// Use the book title as its series name. This most closely mirrors Komga's
    /// "one series containing one book" model.
    /// </summary>
    BookTitle,

    /// <summary>
    /// Keep a series name parsed by Jellyfin from the filename when one exists.
    /// </summary>
    ParsedSeries,

    /// <summary>
    /// Do not assign a series name from the resolver.
    /// </summary>
    None
}

/// <summary>
/// Plugin configuration.
/// </summary>
public sealed class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets a value indicating whether Komga-compatible One-Shot handling is enabled.
    /// </summary>
    public bool EnableKomgaOneShots { get; set; } = true;

    /// <summary>
    /// Gets or sets the Komga-style One-Shots directory matcher.
    /// </summary>
    public string OneShotDirectory { get; set; } = "_oneshots";

    /// <summary>
    /// Gets or sets a value indicating whether One-Shot path matching is case-sensitive.
    /// </summary>
    public bool OneShotMatchCaseSensitive { get; set; }

    /// <summary>
    /// Gets or sets how One-Shots map to Jellyfin's series fields.
    /// </summary>
    public OneShotSeriesMode OneShotSeriesMode { get; set; } = OneShotSeriesMode.BookTitle;

    /// <summary>
    /// Gets or sets a value indicating whether the Advanced Reader Web integration should be enabled.
    /// </summary>
    public bool EnableAdvancedReader { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether supported Jellyfin book Play/Resume actions
    /// should open Advanced Reader instead of the built-in reader.
    /// </summary>
    public bool ReplaceNativeReader { get; set; }
}
