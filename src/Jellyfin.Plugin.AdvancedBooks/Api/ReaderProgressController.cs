using Jellyfin.AdvancedBooks.Core.Archives;
using Jellyfin.AdvancedBooks.Core.Reading;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Stores Advanced Reader positions in Jellyfin's normal per-user item data.
/// </summary>
[ApiController]
[Route("AdvancedBooks/Books/{itemId:guid}/Progress")]
[Authorize]
public sealed class ReaderProgressController : ControllerBase
{
    private readonly ILibraryManager _libraryManager;
    private readonly IAuthorizationContext _authorizationContext;
    private readonly IUserDataManager _userDataManager;
    private readonly IZipBookArchiveReader _archiveReader;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReaderProgressController"/> class.
    /// </summary>
    public ReaderProgressController(
        ILibraryManager libraryManager,
        IAuthorizationContext authorizationContext,
        IUserDataManager userDataManager,
        IZipBookArchiveReader archiveReader)
    {
        _libraryManager = libraryManager;
        _authorizationContext = authorizationContext;
        _userDataManager = userDataManager;
        _archiveReader = archiveReader;
    }

    /// <summary>
    /// Gets the current user's saved reading position.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ReaderProgressDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ReaderProgressDto>> GetProgress(Guid itemId)
    {
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

        var infoResult = TryGetBookInfo(book);
        if (infoResult.Error is not null)
        {
            return infoResult.Error;
        }

        var info = infoResult.Info!;
        var pageCount = info.Pages.Count;
        if (pageCount == 0)
        {
            return NotFound();
        }

        var userData = _userDataManager.GetUserData(user, book);
        var ticks = userData?.PlaybackPositionTicks ?? 0;
        var pageIndex = ReaderProgressMath.FromPlaybackPositionTicks(ticks, pageCount);

        return Ok(new ReaderProgressDto(
            pageIndex,
            pageCount,
            ticks,
            userData?.Played ?? false,
            ReaderProgressMath.GetPercentage(pageIndex, pageCount)));
    }

    /// <summary>
    /// Saves the current user's reading position using Jellyfin's normal user-data store.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ReaderProgressDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ReaderProgressDto>> UpdateProgress(
        Guid itemId,
        [FromBody] UpdateReaderProgressRequest request)
    {
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

        var infoResult = TryGetBookInfo(book);
        if (infoResult.Error is not null)
        {
            return infoResult.Error;
        }

        var pageCount = infoResult.Info!.Pages.Count;
        if (request.PageIndex < 0 || request.PageIndex >= pageCount)
        {
            return Problem(
                title: "Invalid reader page",
                detail: $"Page index must be between 0 and {Math.Max(0, pageCount - 1)}.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var ticks = ReaderProgressMath.ToPlaybackPositionTicks(request.PageIndex);
        var complete = ReaderProgressMath.IsComplete(request.PageIndex, pageCount);

        var update = new UpdateUserItemDataDto
        {
            PlaybackPositionTicks = ticks,
            LastPlayedDate = DateTime.UtcNow,
            Played = complete ? true : null
        };

        _userDataManager.SaveUserData(
            user,
            book,
            update,
            complete ? UserDataSaveReason.PlaybackFinished : UserDataSaveReason.PlaybackProgress);

        var saved = _userDataManager.GetUserData(user, book);
        return Ok(new ReaderProgressDto(
            request.PageIndex,
            pageCount,
            saved?.PlaybackPositionTicks ?? ticks,
            saved?.Played ?? complete,
            ReaderProgressMath.GetPercentage(request.PageIndex, pageCount)));
    }

    private (ArchiveBookInfo? Info, ActionResult? Error) TryGetBookInfo(Book book)
    {
        if (string.IsNullOrWhiteSpace(book.Path) || !_archiveReader.CanRead(book.Path))
        {
            return (null, StatusCode(StatusCodes.Status415UnsupportedMediaType));
        }

        try
        {
            return (_archiveReader.GetBookInfo(book.Path), null);
        }
        catch (FileNotFoundException)
        {
            return (null, NotFound());
        }
        catch (ArchiveSafetyException exception)
        {
            return (null, Problem(
                title: "Comic archive rejected by safety policy",
                detail: exception.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity));
        }
        catch (InvalidDataException exception)
        {
            return (null, Problem(
                title: "Invalid comic archive",
                detail: exception.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity));
        }
    }
}
