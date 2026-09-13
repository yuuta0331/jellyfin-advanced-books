using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

/// <summary>
/// Manual Jellyfin scheduled task for direct metadata import from Komga.
/// </summary>
public sealed class KomgaMetadataSyncTask : IScheduledTask
{
    private readonly IKomgaMetadataSyncService _syncService;
    private readonly ILogger<KomgaMetadataSyncTask> _logger;

    public KomgaMetadataSyncTask(
        IKomgaMetadataSyncService syncService,
        ILogger<KomgaMetadataSyncTask> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    public string Name => "Sync metadata from Komga";

    public string Key => "AdvancedBooksKomgaMetadataSync";

    public string Description
        => "Imports database-backed Book and Series metadata directly from the configured Komga server into matching Jellyfin Books.";

    public string Category => "Advanced Books";

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers() => Array.Empty<TaskTriggerInfo>();

    public async Task ExecuteAsync(
        IProgress<double> progress,
        CancellationToken cancellationToken)
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration?.EnableKomgaMetadataSync != true)
        {
            _logger.LogInformation("Direct Komga metadata synchronization is disabled; scheduled task skipped.");
            progress.Report(100);
            return;
        }

        await _syncService.SyncAsync(progress, cancellationToken).ConfigureAwait(false);
    }
}
