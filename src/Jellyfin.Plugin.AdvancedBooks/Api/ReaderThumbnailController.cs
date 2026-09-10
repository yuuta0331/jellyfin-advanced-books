using Jellyfin.AdvancedBooks.Core.Archives;
using Jellyfin.Plugin.AdvancedBooks.Services;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Serves small cached thumbnails for the Advanced Reader page navigator.
/// </summary>
[ApiController]
[Route("AdvancedBooks/Books/{itemId:guid}/Pages/{pageIndex:int}/Thumbnail")]
[Authorize]
public sealed class ReaderThumbnailController : ControllerBase
{
    private const int DefaultWidth = 180;
    private const int MinimumWidth = 96;
    private const int MaximumWidth = 320;

    private readonly ILibraryManager _libraryManager;
    private readonly IAuthorizationContext _authorizationContext;
    private readonly IReaderThumbnailService _thumbnailService;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReaderThumbnailController"/> class.
    /// </summary>
    public ReaderThumbnailController(
        ILibraryManager libraryManager,
        IAuthorizationContext authorizationContext,
        IReaderThumbnailService thumbnailService)
    {
        _libraryManager = libraryManager;
        _authorizationContext = authorizationContext;
        _thumbnailService = thumbnailService;
    }

    /// <summary>
    /// Gets a bounded-width thumbnail for one archive page.
    /// </summary>
    /// <param name="itemId">Jellyfin Book identifier.</param>
    /// <param name="pageIndex">Zero-based page index.</param>
    /// <param name="width">Requested maximum width, from 96 through 320 pixels.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetThumbnail(
        Guid itemId,
        int pageIndex,
        [FromQuery] int width = DefaultWidth,
        CancellationToken cancellationToken = default)
    {
        if (pageIndex < 0)
        {
            return NotFound();
        }

        if (width < MinimumWidth || width > MaximumWidth)
        {
            return Problem(
                title: "Invalid thumbnail width",
                detail: $"Thumbnail width must be between {MinimumWidth} and {MaximumWidth} pixels.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var authorizationInfo = await _authorizationContext
            .GetAuthorizationInfo(HttpContext)
            .ConfigureAwait(false);

        var user = authorizationInfo.User;
        if (user is null)
        {
            return Forbid();
        }

        if (_libraryManager.GetItemById(itemId) is not Book book || !book.IsVisible(user))
        {
            return NotFound();
        }

        try
        {
            var cacheWidth = NormalizeCacheWidth(width);
            var thumbnail = await _thumbnailService
                .GetThumbnailAsync(book, pageIndex, cacheWidth, cancellationToken)
                .ConfigureAwait(false);

            Response.Headers.CacheControl = "private, max-age=86400";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["X-AdvancedBooks-Thumbnail-Width"] = thumbnail.Width.ToString(System.Globalization.CultureInfo.InvariantCulture);
            Response.GetTypedHeaders().LastModified = thumbnail.LastModifiedUtc;

            return PhysicalFile(thumbnail.Path, thumbnail.ContentType, enableRangeProcessing: false);
        }
        catch (ArgumentOutOfRangeException)
        {
            return NotFound();
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }
        catch (NotSupportedException)
        {
            return StatusCode(StatusCodes.Status415UnsupportedMediaType);
        }
        catch (ReaderThumbnailUnavailableException exception)
        {
            return Problem(
                title: "Reader thumbnail unavailable",
                detail: exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (ArchiveSafetyException exception)
        {
            return Problem(
                title: "Comic archive rejected by safety policy",
                detail: exception.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity);
        }
        catch (InvalidDataException exception)
        {
            return Problem(
                title: "Invalid comic archive",
                detail: exception.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity);
        }
    }

    private static int NormalizeCacheWidth(int requestedWidth)
    {
        return requestedWidth switch
        {
            < 128 => 96,
            < 180 => 128,
            < 240 => 180,
            < 320 => 240,
            _ => 320
        };
    }
}
