using Jellyfin.AdvancedBooks.Core.Archives;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Reader-facing API for archive-backed books.
/// </summary>
[ApiController]
[Route("AdvancedBooks")]
[Authorize]
public sealed class AdvancedBooksController : ControllerBase
{
    private readonly ILibraryManager _libraryManager;
    private readonly IAuthorizationContext _authorizationContext;
    private readonly IZipBookArchiveReader _archiveReader;

    /// <summary>
    /// Initializes a new instance of the <see cref="AdvancedBooksController"/> class.
    /// </summary>
    /// <param name="libraryManager">Jellyfin library manager.</param>
    /// <param name="authorizationContext">Current request authorization context.</param>
    /// <param name="archiveReader">Safe archive reader.</param>
    public AdvancedBooksController(
        ILibraryManager libraryManager,
        IAuthorizationContext authorizationContext,
        IZipBookArchiveReader archiveReader)
    {
        _libraryManager = libraryManager;
        _authorizationContext = authorizationContext;
        _archiveReader = archiveReader;
    }

    /// <summary>
    /// Gets naturally ordered image pages for a CBZ/ZIP-backed Jellyfin book.
    /// </summary>
    /// <param name="itemId">Jellyfin book item identifier.</param>
    /// <returns>Archive and page metadata without exposing the server filesystem path.</returns>
    [HttpGet("Books/{itemId:guid}/Pages")]
    [ProducesResponseType(typeof(ArchiveBookInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ArchiveBookInfo>> GetPages(Guid itemId)
    {
        var access = await GetAccessibleBook(itemId).ConfigureAwait(false);
        if (!access.HasUser)
        {
            return Forbid();
        }

        if (access.Book is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(access.Book.Path) || !_archiveReader.CanRead(access.Book.Path))
        {
            return StatusCode(StatusCodes.Status415UnsupportedMediaType);
        }

        try
        {
            return Ok(_archiveReader.GetBookInfo(access.Book.Path));
        }
        catch (FileNotFoundException)
        {
            return NotFound();
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

    /// <summary>
    /// Streams one image page without downloading or extracting the whole archive.
    /// </summary>
    /// <param name="itemId">Jellyfin book item identifier.</param>
    /// <param name="pageIndex">Zero-based natural-order page index.</param>
    /// <param name="cancellationToken">Request cancellation token.</param>
    /// <returns>The requested image page.</returns>
    [HttpGet("Books/{itemId:guid}/Pages/{pageIndex:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> GetPage(
        Guid itemId,
        int pageIndex,
        CancellationToken cancellationToken)
    {
        if (pageIndex < 0)
        {
            return NotFound();
        }

        var access = await GetAccessibleBook(itemId).ConfigureAwait(false);
        if (!access.HasUser)
        {
            return Forbid();
        }

        if (access.Book is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(access.Book.Path) || !_archiveReader.CanRead(access.Book.Path))
        {
            return StatusCode(StatusCodes.Status415UnsupportedMediaType);
        }

        ArchivePageLease lease;
        try
        {
            lease = _archiveReader.OpenPage(access.Book.Path, pageIndex);
        }
        catch (ArgumentOutOfRangeException)
        {
            return NotFound();
        }
        catch (FileNotFoundException)
        {
            return NotFound();
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

        using (lease)
        {
            Response.StatusCode = StatusCodes.Status200OK;
            Response.ContentType = lease.Page.ContentType;
            Response.ContentLength = lease.Page.Length;
            Response.Headers.CacheControl = "private, max-age=3600";
            Response.Headers["X-Content-Type-Options"] = "nosniff";

            try
            {
                await lease.CopyToAsync(Response.Body, cancellationToken).ConfigureAwait(false);
            }
            catch (InvalidDataException) when (Response.HasStarted)
            {
                HttpContext.Abort();
                return new EmptyResult();
            }
            catch (ArchiveSafetyException) when (Response.HasStarted)
            {
                HttpContext.Abort();
                return new EmptyResult();
            }
        }

        return new EmptyResult();
    }

    private async Task<(Book? Book, bool HasUser)> GetAccessibleBook(Guid itemId)
    {
        var authorizationInfo = await _authorizationContext
            .GetAuthorizationInfo(HttpContext)
            .ConfigureAwait(false);

        if (authorizationInfo.User is null)
        {
            return (null, false);
        }

        if (_libraryManager.GetItemById(itemId) is not Book book || !book.IsVisible(authorizationInfo.User))
        {
            return (null, true);
        }

        return (book, true);
    }
}
