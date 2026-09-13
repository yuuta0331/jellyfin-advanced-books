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
        var isUnc = normalized.StartsWith("//", StringComparison.Ordinal);
        var body = isUnc ? normalized[2..] : normalized;

        while (body.Contains("//", StringComparison.Ordinal))
        {
            body = body.Replace("//", "/", StringComparison.Ordinal);
        }

        normalized = isUnc ? "//" + body : body;

        if (normalized.EndsWith("/", StringComparison.Ordinal)
            && !IsFilesystemRoot(normalized))
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

            mappedPath = NormalizeComparablePath(JoinMappedPath(mapping.Target, remainder));
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
        if (candidate.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            candidate = DecodeFileUriPath(candidate);
            if (candidate.Length == 0)
            {
                return false;
            }
        }
        else if (LooksLikeWindowsDrivePath(candidate))
        {
            candidate = Uri.UnescapeDataString(candidate);
        }
        else if (Uri.TryCreate(candidate, UriKind.Absolute, out var absoluteUri)
                 && !string.IsNullOrEmpty(absoluteUri.Scheme))
        {
            return false;
        }
        else
        {
            candidate = Uri.UnescapeDataString(candidate);
        }

        path = NormalizeComparablePath(candidate);
        return path.Length > 0;
    }

    private static string DecodeFileUriPath(string value)
    {
        var encoded = value["file:".Length..];

        // Komga commonly emits file:/path and file:///path. Keep UNC file://host/share
        // recognizable while removing only URI syntax, not filesystem separators.
        if (encoded.StartsWith("///", StringComparison.Ordinal))
        {
            encoded = encoded[2..];
        }
        else if (encoded.StartsWith("//", StringComparison.Ordinal))
        {
            // UNC form: file://server/share -> //server/share.
            encoded = "//" + encoded[2..];
        }

        var decoded = Uri.UnescapeDataString(encoded);

        // RFC file URIs for Windows drives often encode an extra leading slash:
        // file:///G:/Books/A.cbz -> /G:/Books/A.cbz.
        if (decoded.Length >= 3
            && decoded[0] == '/'
            && char.IsAsciiLetter(decoded[1])
            && decoded[2] == ':')
        {
            decoded = decoded[1..];
        }

        return decoded;
    }

    private static bool LooksLikeWindowsDrivePath(string value)
        => value.Length >= 3
            && char.IsAsciiLetter(value[0])
            && value[1] == ':'
            && (value[2] == '/' || value[2] == '\\');

    private static string JoinMappedPath(string target, string remainder)
    {
        if (remainder.Length == 0)
        {
            return target;
        }

        if (target.EndsWith("/", StringComparison.Ordinal)
            || remainder.StartsWith("/", StringComparison.Ordinal))
        {
            return target + remainder;
        }

        return target + "/" + remainder;
    }

    private static bool HasPrefixBoundary(string path, string prefix, StringComparison comparison)
    {
        if (!path.StartsWith(prefix, comparison))
        {
            return false;
        }

        return path.Length == prefix.Length
            || prefix.EndsWith("/", StringComparison.Ordinal)
            || path[prefix.Length] == '/';
    }

    private static bool IsFilesystemRoot(string path)
        => path == "/"
            || (path.Length == 3
                && char.IsAsciiLetter(path[0])
                && path[1] == ':'
                && path[2] == '/');
}
