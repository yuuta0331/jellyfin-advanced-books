namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

/// <summary>
/// Result of a direct Komga metadata synchronization pass.
/// </summary>
public sealed record KomgaMetadataSyncResult(
    int KomgaBooks,
    int JellyfinBooks,
    int Matched,
    int Updated,
    int Unchanged,
    int Unmatched,
    int Skipped,
    int Errors);

/// <summary>
/// Synchronizes Komga's database-backed metadata into matching Jellyfin Book items.
/// </summary>
public interface IKomgaMetadataSyncService
{
    /// <summary>
    /// Tests the configured Komga connection.
    /// </summary>
    Task TestConnectionAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Runs one metadata synchronization pass.
    /// </summary>
    Task<KomgaMetadataSyncResult> SyncAsync(
        IProgress<double>? progress,
        CancellationToken cancellationToken);
}
