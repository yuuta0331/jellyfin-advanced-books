using System.Globalization;
using Jellyfin.AdvancedBooks.Core.Komga;
using Jellyfin.Data.Enums;
using Jellyfin.Plugin.AdvancedBooks.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

internal sealed class KomgaMetadataSyncService : IKomgaMetadataSyncService
{
    private const string KomgaBookProviderId = "KomgaBook";
    private const string KomgaSeriesProviderId = "KomgaSeries";
    private const string IsbnProviderId = "ISBN";

    private readonly IKomgaApiClient _apiClient;
    private readonly ILibraryManager _libraryManager;
    private readonly ILogger<KomgaMetadataSyncService> _logger;
    private readonly SemaphoreSlim _syncLock = new(1, 1);

    public KomgaMetadataSyncService(
        IKomgaApiClient apiClient,
        ILibraryManager libraryManager,
        ILogger<KomgaMetadataSyncService> logger)
    {
        _apiClient = apiClient;
        _libraryManager = libraryManager;
        _logger = logger;
    }

    public Task TestConnectionAsync(CancellationToken cancellationToken)
    {
        var configuration = GetEnabledConfiguration(requireEnabled: false);
        ValidateConnectionConfiguration(configuration);
        return _apiClient.TestConnectionAsync(configuration, cancellationToken);
    }

    public async Task<KomgaMetadataSyncResult> SyncAsync(
        IProgress<double>? progress,
        CancellationToken cancellationToken)
    {
        var configuration = GetEnabledConfiguration(requireEnabled: true);
        ValidateConnectionConfiguration(configuration);

        await _syncLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await SyncCoreAsync(configuration, progress, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _syncLock.Release();
        }
    }

    private async Task<KomgaMetadataSyncResult> SyncCoreAsync(
        PluginConfiguration configuration,
        IProgress<double>? progress,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting direct Komga metadata synchronization.");
        progress?.Report(0);

        var jellyfinBooks = _libraryManager
            .GetItemList(new InternalItemsQuery
            {
                IncludeItemTypes = [BaseItemKind.Book],
                IsVirtualItem = false,
                GroupByPresentationUniqueKey = false
            })
            .OfType<Book>()
            .Where(static book => !string.IsNullOrWhiteSpace(book.Path))
            .ToArray();

        var comparer = configuration.KomgaPathMatchCaseSensitive
            ? StringComparer.Ordinal
            : StringComparer.OrdinalIgnoreCase;

        var jellyfinByPath = new Dictionary<string, Book>(comparer);
        foreach (var book in jellyfinBooks.OrderBy(static item => item.Id))
        {
            var path = KomgaPathMapper.NormalizeComparablePath(book.Path);
            if (path.Length == 0)
            {
                continue;
            }

            if (!jellyfinByPath.TryAdd(path, book))
            {
                _logger.LogWarning(
                    "Multiple Jellyfin Books share normalized path {Path}; Komga sync will use item {ItemId}.",
                    path,
                    jellyfinByPath[path].Id);
            }
        }

        var komgaBooks = await _apiClient.GetBooksAsync(configuration, cancellationToken).ConfigureAwait(false);
        var seriesCache = new Dictionary<string, KomgaSeriesDto?>(StringComparer.Ordinal);
        var matched = 0;
        var updated = 0;
        var unchanged = 0;
        var unmatched = 0;
        var skipped = 0;
        var errors = 0;
        var processed = 0;

        foreach (var komgaBook in komgaBooks)
        {
            cancellationToken.ThrowIfCancellationRequested();
            processed++;

            try
            {
                if (komgaBook.Deleted
                    || string.IsNullOrWhiteSpace(komgaBook.Id)
                    || !KomgaPathMapper.TryMapBookUrl(
                        komgaBook.Url,
                        configuration.KomgaPathMappings,
                        configuration.KomgaPathMatchCaseSensitive,
                        out var mappedPath))
                {
                    skipped++;
                    continue;
                }

                if (!jellyfinByPath.TryGetValue(mappedPath, out var jellyfinBook))
                {
                    unmatched++;
                    _logger.LogDebug(
                        "No Jellyfin Book matched Komga book {KomgaBookId} path {MappedPath}.",
                        komgaBook.Id,
                        mappedPath);
                    continue;
                }

                matched++;
                var series = await GetSeriesAsync(
                    configuration,
                    komgaBook.SeriesId,
                    seriesCache,
                    cancellationToken).ConfigureAwait(false);

                var itemChanged = ApplyMetadata(jellyfinBook, komgaBook, series);
                var peopleChanged = await UpdatePeopleIfChanged(
                    jellyfinBook,
                    komgaBook.Metadata.Authors,
                    cancellationToken).ConfigureAwait(false);

                if (itemChanged)
                {
                    var parent = jellyfinBook.GetParent();
                    if (parent is null)
                    {
                        throw new InvalidOperationException(
                            $"Jellyfin Book {jellyfinBook.Id} has no parent and cannot be persisted safely.");
                    }

                    await _libraryManager.UpdateItemAsync(
                        jellyfinBook,
                        parent,
                        ItemUpdateType.MetadataEdit,
                        cancellationToken).ConfigureAwait(false);
                }

                if (itemChanged || peopleChanged)
                {
                    updated++;
                }
                else
                {
                    unchanged++;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                errors++;
                _logger.LogError(
                    exception,
                    "Failed to synchronize Komga book {KomgaBookId}.",
                    komgaBook.Id);
            }
            finally
            {
                progress?.Report(komgaBooks.Count == 0 ? 100 : processed * 100d / komgaBooks.Count);
            }
        }

        var result = new KomgaMetadataSyncResult(
            komgaBooks.Count,
            jellyfinBooks.Length,
            matched,
            updated,
            unchanged,
            unmatched,
            skipped,
            errors);

        _logger.LogInformation(
            "Komga metadata synchronization complete. Komga={KomgaBooks}, Jellyfin={JellyfinBooks}, matched={Matched}, updated={Updated}, unchanged={Unchanged}, unmatched={Unmatched}, skipped={Skipped}, errors={Errors}.",
            result.KomgaBooks,
            result.JellyfinBooks,
            result.Matched,
            result.Updated,
            result.Unchanged,
            result.Unmatched,
            result.Skipped,
            result.Errors);

        progress?.Report(100);
        return result;
    }

    private async Task<KomgaSeriesDto?> GetSeriesAsync(
        PluginConfiguration configuration,
        string seriesId,
        IDictionary<string, KomgaSeriesDto?> cache,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(seriesId))
        {
            return null;
        }

        if (cache.TryGetValue(seriesId, out var cached))
        {
            return cached;
        }

        var series = await _apiClient
            .GetSeriesAsync(configuration, seriesId, cancellationToken)
            .ConfigureAwait(false);

        if (series?.Deleted == true)
        {
            series = null;
        }

        cache[seriesId] = series;
        return series;
    }

    private bool ApplyMetadata(Book target, KomgaBookDto source, KomgaSeriesDto? series)
    {
        var changed = false;
        var bookMetadata = source.Metadata ?? new KomgaBookMetadataDto();
        var seriesMetadata = series?.Metadata;

        var title = Clean(bookMetadata.Title);
        if (title.Length > 0)
        {
            changed |= AssignString(target.Name, title, value => target.Name = value);
        }

        var overview = Clean(bookMetadata.Summary);
        if (overview.Length == 0 && seriesMetadata is not null)
        {
            overview = Clean(seriesMetadata.Summary);
        }

        changed |= AssignString(target.Overview, overview, value => target.Overview = value);

        var seriesTitle = Clean(seriesMetadata?.Title);
        if (seriesTitle.Length == 0)
        {
            seriesTitle = Clean(source.SeriesTitle);
        }

        if (seriesTitle.Length > 0)
        {
            changed |= AssignString(target.SeriesName, seriesTitle, value => target.SeriesName = value);
        }

        var seriesKey = string.IsNullOrWhiteSpace(source.SeriesId)
            ? string.Empty
            : $"AdvancedBooks:Komga:{source.SeriesId.Trim()}";
        changed |= AssignString(
            target.SeriesPresentationUniqueKey,
            seriesKey,
            value => target.SeriesPresentationUniqueKey = value);

        var releaseDate = bookMetadata.ReleaseDate?.ToUniversalTime();
        if (target.PremiereDate != releaseDate)
        {
            target.PremiereDate = releaseDate;
            changed = true;
        }

        var year = releaseDate?.Year;
        if (target.ProductionYear != year)
        {
            target.ProductionYear = year;
            changed = true;
        }

        var index = ParseIndexNumber(bookMetadata.Number, bookMetadata.NumberSort);
        if (index.HasValue && target.IndexNumber != index)
        {
            target.IndexNumber = index;
            changed = true;
        }

        var genres = CleanDistinct(seriesMetadata?.Genres);
        changed |= AssignArray(target.Genres, genres, value => target.Genres = value);

        var publisher = Clean(seriesMetadata?.Publisher);
        var studios = publisher.Length == 0 ? Array.Empty<string>() : [publisher];
        changed |= AssignArray(target.Studios, studios, value => target.Studios = value);

        var tags = CleanDistinct(
            (seriesMetadata?.Tags ?? [])
            .Concat(bookMetadata.Tags ?? []));
        changed |= AssignArray(target.Tags, tags, value => target.Tags = value);

        var language = Clean(seriesMetadata?.Language);
        changed |= AssignString(
            target.PreferredMetadataLanguage,
            language,
            value => target.PreferredMetadataLanguage = value);

        changed |= SetProviderId(target, KomgaBookProviderId, source.Id);
        changed |= SetProviderId(target, KomgaSeriesProviderId, source.SeriesId);
        changed |= SetProviderId(target, IsbnProviderId, bookMetadata.Isbn);

        return changed;
    }

    private async Task<bool> UpdatePeopleIfChanged(
        Book book,
        IReadOnlyList<KomgaAuthorDto>? authors,
        CancellationToken cancellationToken)
    {
        var target = BuildPeople(authors);
        var current = _libraryManager.GetPeople(book)
            .OrderBy(static person => person.SortOrder ?? int.MaxValue)
            .ThenBy(static person => person.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (PeopleEqual(current, target))
        {
            return false;
        }

        await _libraryManager.UpdatePeopleAsync(book, target, cancellationToken).ConfigureAwait(false);
        return true;
    }

    private static List<PersonInfo> BuildPeople(IReadOnlyList<KomgaAuthorDto>? authors)
    {
        if (authors is null || authors.Count == 0)
        {
            return [];
        }

        var result = new List<PersonInfo>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sortOrder = 0;

        foreach (var author in authors)
        {
            var name = Clean(author.Name);
            if (name.Length == 0)
            {
                continue;
            }

            var role = Clean(author.Role);
            var kind = MapPersonKind(role);
            var roleText = role.Length == 0 ? kind.ToString() : role;
            var key = $"{name}\n{roleText}\n{kind}";
            if (!seen.Add(key))
            {
                continue;
            }

            result.Add(new PersonInfo
            {
                Name = name,
                Role = roleText,
                Type = kind,
                SortOrder = sortOrder++
            });
        }

        return result;
    }

    private static PersonKind MapPersonKind(string role)
    {
        return role.Trim().ToLowerInvariant() switch
        {
            "" or "author" or "writer" or "scenario" or "story" => PersonKind.Author,
            "artist" or "illustrator" => PersonKind.Illustrator,
            "penciller" or "penciler" => PersonKind.Penciller,
            "inker" => PersonKind.Inker,
            "colorist" or "colourist" => PersonKind.Colorist,
            "letterer" => PersonKind.Letterer,
            "cover" or "cover artist" or "coverartist" => PersonKind.CoverArtist,
            "editor" => PersonKind.Editor,
            "translator" => PersonKind.Translator,
            "creator" => PersonKind.Creator,
            _ => PersonKind.Creator
        };
    }

    private static bool PeopleEqual(
        IReadOnlyList<PersonInfo> left,
        IReadOnlyList<PersonInfo> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (!string.Equals(left[i].Name, right[i].Name, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(left[i].Role, right[i].Role, StringComparison.OrdinalIgnoreCase)
                || left[i].Type != right[i].Type
                || left[i].SortOrder != right[i].SortOrder)
            {
                return false;
            }
        }

        return true;
    }

    private static int? ParseIndexNumber(string number, double numberSort)
    {
        if (int.TryParse(number?.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        if (double.IsFinite(numberSort)
            && numberSort >= int.MinValue
            && numberSort <= int.MaxValue
            && Math.Abs(numberSort - Math.Round(numberSort)) < 0.000001)
        {
            return checked((int)Math.Round(numberSort));
        }

        return null;
    }

    private static string[] CleanDistinct(IEnumerable<string>? values)
    {
        if (values is null)
        {
            return [];
        }

        return values
            .Select(Clean)
            .Where(static value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string Clean(string? value) => value?.Trim() ?? string.Empty;

    private static bool AssignString(string? current, string next, Action<string> assign)
    {
        if (string.Equals(current ?? string.Empty, next, StringComparison.Ordinal))
        {
            return false;
        }

        assign(next);
        return true;
    }

    private static bool AssignArray(
        IReadOnlyList<string>? current,
        string[] next,
        Action<string[]> assign)
    {
        if (current is not null
            && current.Count == next.Length
            && current.SequenceEqual(next, StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        assign(next);
        return true;
    }

    private static bool SetProviderId(BaseItem item, string key, string? value)
    {
        item.ProviderIds ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var cleaned = Clean(value);

        if (cleaned.Length == 0)
        {
            return item.ProviderIds.Remove(key);
        }

        if (item.ProviderIds.TryGetValue(key, out var current)
            && string.Equals(current, cleaned, StringComparison.Ordinal))
        {
            return false;
        }

        item.ProviderIds[key] = cleaned;
        return true;
    }

    private static PluginConfiguration GetEnabledConfiguration(bool requireEnabled)
    {
        var configuration = Plugin.Instance?.Configuration
            ?? throw new InvalidOperationException("Advanced Books configuration is unavailable.");

        if (requireEnabled && !configuration.EnableKomgaMetadataSync)
        {
            throw new InvalidOperationException("Direct Komga metadata synchronization is disabled.");
        }

        return configuration;
    }

    private static void ValidateConnectionConfiguration(PluginConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(configuration.KomgaServerUrl))
        {
            throw new InvalidOperationException("Komga server URL is not configured.");
        }

        if (string.IsNullOrWhiteSpace(configuration.KomgaApiKey)
            && string.IsNullOrWhiteSpace(configuration.KomgaUsername))
        {
            throw new InvalidOperationException(
                "Configure a Komga API key or Basic-auth username before synchronizing metadata.");
        }
    }
}
