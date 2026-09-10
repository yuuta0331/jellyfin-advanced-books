namespace Jellyfin.AdvancedBooks.Core.Archives;

/// <summary>
/// Defensive limits applied before pages are exposed or decompressed.
/// </summary>
public sealed class ZipArchiveSafetyOptions
{
    /// <summary>
    /// Gets a conservative default policy suitable for comic archives.
    /// </summary>
    public static ZipArchiveSafetyOptions Default { get; } = new();

    /// <summary>
    /// Gets the maximum number of entries, including non-image metadata entries.
    /// </summary>
    public int MaxArchiveEntries { get; init; } = 20_000;

    /// <summary>
    /// Gets the maximum number of image pages.
    /// </summary>
    public int MaxPages { get; init; } = 10_000;

    /// <summary>
    /// Gets the maximum uncompressed size of one image page.
    /// </summary>
    public long MaxUncompressedPageBytes { get; init; } = 128L * 1024 * 1024;

    /// <summary>
    /// Gets the maximum combined uncompressed size of all image pages.
    /// </summary>
    public long MaxTotalUncompressedPageBytes { get; init; } = 8L * 1024 * 1024 * 1024;

    /// <summary>
    /// Gets the maximum allowed uncompressed-to-compressed ratio for one page.
    /// </summary>
    public double MaxCompressionRatio { get; init; } = 250d;
}
