using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

/// <summary>
/// Optionally imports Komga metadata after a Jellyfin library scan.
/// </summary>
public sealed class KomgaMetadataPostScanTask : ILibraryPostScanTask
{
    private readonly IKomgaMetadataSyncService _syncService;
    private readonly ILogger<KomgaMetadataPostScanTask> _logger;

    public KomgaMetadataPostScanTask(
        IKomgaMetadataSyncService syncService,
        ILogger<KomgaMetadataPostScanTask> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    public async Task Run(IProgress<double> progress, CancellationToken cancellationToken)
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration?.EnableKomgaMetadataSync != true
            || !configuration.KomgaSyncAfterLibraryScan)
        {
            progress.Report(100);
            return;
        }

        try
        {
            await _syncService.SyncAsync(progress, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Direct Komga metadata synchronization failed after the Jellyfin library scan.");
        }
    }
}
