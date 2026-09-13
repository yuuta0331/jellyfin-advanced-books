namespace Jellyfin.AdvancedBooks.Core.Komga;

/// <summary>
/// Converts Komga file URLs into paths comparable with Jellyfin item paths.
/// </summary>
public static class KomgaPathMapper
{
    /// <summary>
    /// Normalizes a filesystem path for stable cross-platform comparison.
    /// </summary>
    public static string NormalizeComparablePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return string.Empty;
        }

        var normalized = path.Trim().Replace('\\', '/');

        while (normalized.Contains("//", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("//", "/", StringComparison.Ordinal);
        }

        if (normalized.Length > 1 && normalized.EndsWith('/', StringComparison.Ordinal))
        {
            normalized = normalized.TrimEnd('/');
        }

        return normalized;
    }

    /// <summary>
    /// Converts a Komga BookDto URL to the corresponding normalized Jellyfin path.
    /// Mapping lines use <c>komga-prefix =&gt; jellyfin-prefix</c>.
    /// </summary>
    public static bool TryMapBookUrl(
        string? bookUrl,
        string? mappings,
        bool caseSensitive,
        out string mappedPath)
    {
        mappedPath = string.Empty;
        if (!TryGetPath(bookUrl, out var sourcePath))
        {
            return false;
        }

        var comparison = caseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
        var parsedMappings = ParseMappings(mappings)
            .OrderByDescending(static mapping => mapping.Source.Length)
            .ToArray();

        foreach (var mapping in parsedMappings)
        {
            if (!HasPrefixBoundary(sourcePath, mapping.Source, comparison))
            {
                continue;
            }

            var remainder = sourcePath.Length == mapping.Source.Length
                ? string.Empty
                : sourcePath[mapping.Source.Length..];

            mappedPath = NormalizeComparablePath(mapping.Target + remainder);
            return mappedPath.Length > 0;
        }

        mappedPath = sourcePath;
        return true;
    }

    /// <summary>
    /// Parses configured path mappings, ignoring invalid/comment lines.
    /// </summary>
    public static IReadOnlyList<(string Source, string Target)> ParseMappings(string? mappings)
    {
        if (string.IsNullOrWhiteSpace(mappings))
        {
            return Array.Empty<(string, string)>();
        }

        var result = new List<(string Source, string Target)>();
        foreach (var rawLine in mappings.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var separator = line.IndexOf("=>", StringComparison.Ordinal);
            if (separator <= 0 || separator >= line.Length - 2)
            {
                continue;
            }

            var source = NormalizeComparablePath(line[..separator]);
            var target = NormalizeComparablePath(line[(separator + 2)..]);
            if (source.Length == 0 || target.Length == 0)
            {
                continue;
            }

            result.Add((source, target));
        }

        return result;
    }

    private static bool TryGetPath(string? bookUrl, out string path)
    {
        path = string.Empty;
        if (string.IsNullOrWhiteSpace(bookUrl))
        {
            return false;
        }

        var candidate = bookUrl.Trim();
        if (Uri.TryCreate(candidate, UriKind.Absolute, out var uri))
        {
            if (!uri.IsFile)
            {
                return false;
            }

            candidate = Uri.UnescapeDataString(uri.LocalPath);
        }
        else if (candidate.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        path = NormalizeComparablePath(candidate);
        return path.Length > 0;
    }

    private static bool HasPrefixBoundary(string path, string prefix, StringComparison comparison)
    {
        if (!path.StartsWith(prefix, comparison))
        {
            return false;
        }

        return path.Length == prefix.Length
            || prefix == "/"
            || path[prefix.Length] == '/';
    }
}
