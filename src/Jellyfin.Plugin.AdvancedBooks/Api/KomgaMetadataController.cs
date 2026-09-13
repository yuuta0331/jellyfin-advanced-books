using Jellyfin.Plugin.AdvancedBooks.Services.Komga;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Administrative endpoints for the direct Komga metadata integration.
/// </summary>
[ApiController]
[Route("AdvancedBooks/Komga")]
[Authorize]
public sealed class KomgaMetadataController : ControllerBase
{
    private readonly IKomgaMetadataSyncService _syncService;

    public KomgaMetadataController(IKomgaMetadataSyncService syncService)
    {
        _syncService = syncService;
    }

    /// <summary>
    /// Tests the saved Komga connection settings.
    /// </summary>
    [HttpPost("Test")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> Test(CancellationToken cancellationToken)
    {
        if (!User.IsInRole("Administrator"))
        {
            return Forbid();
        }

        try
        {
            await _syncService.TestConnectionAsync(cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            return Problem(
                title: "Komga connection failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway);
        }
    }

    /// <summary>
    /// Runs a direct Komga metadata synchronization using the saved settings.
    /// </summary>
    [HttpPost("Sync")]
    [ProducesResponseType(typeof(KomgaMetadataSyncResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<KomgaMetadataSyncResult>> Sync(CancellationToken cancellationToken)
    {
        if (!User.IsInRole("Administrator"))
        {
            return Forbid();
        }

        try
        {
            var result = await _syncService.SyncAsync(null, cancellationToken).ConfigureAwait(false);
            return Ok(result);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            return Problem(
                title: "Komga metadata synchronization failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway);
        }
    }

}
