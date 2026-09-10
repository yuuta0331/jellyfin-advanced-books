namespace Jellyfin.AdvancedBooks.Core.Komga;

/// <summary>
/// Implements Komga-compatible matching for the configured One-Shots directory.
/// </summary>
public static class KomgaOneShotPathMatcher
{
    /// <summary>
    /// Returns whether a directory path should be treated as being inside a Komga One-Shots area.
    /// </summary>
    /// <param name="directoryPath">Directory path to inspect.</param>
    /// <param name="configuredDirectory">
    /// Komga-style directory matcher. A value such as <c>_oneshots</c> matches anywhere in the
    /// directory path. Prefixing the value with <c>/</c> switches to directory-segment prefix matching.
    /// </param>
    /// <param name="caseSensitive">Whether matching is case-sensitive.</param>
    /// <returns><see langword="true"/> when the path matches the configured One-Shots rule.</returns>
    public static bool IsMatch(string? directoryPath, string? configuredDirectory, bool caseSensitive = false)
    {
        if (string.IsNullOrWhiteSpace(directoryPath) || string.IsNullOrWhiteSpace(configuredDirectory))
        {
            return false;
        }

        var path = Normalize(directoryPath);
        var pattern = Normalize(configuredDirectory.Trim());
        var comparison = caseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;

        if (pattern.Length == 0)
        {
            return false;
        }

        if (pattern[0] != '/')
        {
            return path.Contains(pattern, comparison);
        }

        var prefix = pattern.TrimStart('/');
        if (prefix.Length == 0)
        {
            return false;
        }

        foreach (var segment in path.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (segment.StartsWith(prefix, comparison))
            {
                return true;
            }
        }

        return false;
    }

    private static string Normalize(string value)
        => value.Replace('\\', '/');
}
