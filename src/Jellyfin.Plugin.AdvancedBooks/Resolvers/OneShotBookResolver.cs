using Emby.Naming.Book;
using Jellyfin.AdvancedBooks.Core.Komga;
using Jellyfin.Data.Enums;
using Jellyfin.Plugin.AdvancedBooks.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Resolvers;

namespace Jellyfin.Plugin.AdvancedBooks.Resolvers;

/// <summary>
/// Resolves books inside Komga-style One-Shot directories before Jellyfin's default book resolver.
/// </summary>
public sealed class OneShotBookResolver : IItemResolver
{
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".azw",
        ".azw3",
        ".cb7",
        ".cbr",
        ".cbt",
        ".cbz",
        ".epub",
        ".mobi",
        ".pdf"
    };

    /// <inheritdoc />
    public ResolverPriority Priority => ResolverPriority.Plugin;

    /// <inheritdoc />
    public BaseItem? ResolvePath(ItemResolveArgs args)
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration is null || !configuration.EnableKomgaOneShots)
        {
            return null;
        }

        if (args.GetCollectionType() != CollectionType.books)
        {
            return null;
        }

        return args.IsDirectory
            ? ResolveDirectory(args, configuration)
            : ResolveFile(args.Path, configuration, isInMixedFolder: true);
    }

    private static BaseItem? ResolveDirectory(ItemResolveArgs args, PluginConfiguration configuration)
    {
        if (!KomgaOneShotPathMatcher.IsMatch(
                args.Path,
                configuration.OneShotDirectory,
                configuration.OneShotMatchCaseSensitive))
        {
            return null;
        }

        var bookFiles = args.FileSystemChildren
            .Where(file => IsSupportedBook(file.FullName))
            .ToList();

        // Jellyfin's default BookResolver treats a directory containing exactly one supported
        // book as the book itself. Intercept that edge case so "_oneshots/<single book>"
        // does not inherit the One-Shots directory name as its series.
        if (bookFiles.Count != 1)
        {
            return null;
        }

        return CreateBook(bookFiles[0].FullName, configuration, isInMixedFolder: false);
    }

    private static BaseItem? ResolveFile(
        string path,
        PluginConfiguration configuration,
        bool isInMixedFolder)
    {
        if (!IsSupportedBook(path))
        {
            return null;
        }

        var directory = Path.GetDirectoryName(path);
        if (!KomgaOneShotPathMatcher.IsMatch(
                directory,
                configuration.OneShotDirectory,
                configuration.OneShotMatchCaseSensitive))
        {
            return null;
        }

        return CreateBook(path, configuration, isInMixedFolder);
    }

    private static Book CreateBook(
        string path,
        PluginConfiguration configuration,
        bool isInMixedFolder)
    {
        var fileName = Path.GetFileNameWithoutExtension(path);
        var parsed = BookFileNameParser.Parse(fileName);
        var name = string.IsNullOrWhiteSpace(parsed.Name) ? fileName : parsed.Name;

        var seriesName = configuration.OneShotSeriesMode switch
        {
            OneShotSeriesMode.BookTitle => name,
            OneShotSeriesMode.ParsedSeries => parsed.SeriesName ?? string.Empty,
            OneShotSeriesMode.None => string.Empty,
            _ => name
        };

        return new Book
        {
            Path = path,
            Name = name,
            IndexNumber = parsed.Index ?? 1,
            ParentIndexNumber = parsed.ParentIndex,
            ProductionYear = parsed.Year,
            SeriesName = seriesName,
            IsInMixedFolder = isInMixedFolder
        };
    }

    private static bool IsSupportedBook(string path)
        => SupportedExtensions.Contains(Path.GetExtension(path));
}
