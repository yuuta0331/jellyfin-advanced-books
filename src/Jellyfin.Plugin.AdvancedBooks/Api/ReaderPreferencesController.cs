using System.Globalization;
using Jellyfin.AdvancedBooks.Core.Reading;
using Jellyfin.Database.Implementations.Entities;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AdvancedBooks.Api;

/// <summary>
/// Stores Advanced Reader preferences in Jellyfin's per-user display-preferences database.
/// </summary>
[ApiController]
[Route("AdvancedBooks/Reader/Preferences")]
[Authorize]
public sealed class ReaderPreferencesController : ControllerBase
{
    private const string ClientName = "AdvancedBooksReader";
    private const string LayoutKey = "layout";
    private const string DirectionKey = "direction";
    private const string FitKey = "fit";
    private const string ZoomKey = "zoom";

    // Stable pseudo-item namespace reserved for global Advanced Reader preferences.
    private static readonly Guid PreferencesItemId = new("9d7f1b84-7d41-4f9f-bf32-9f26d8601a72");

    private readonly IAuthorizationContext _authorizationContext;
    private readonly IDisplayPreferencesManager _displayPreferencesManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReaderPreferencesController"/> class.
    /// </summary>
    public ReaderPreferencesController(
        IAuthorizationContext authorizationContext,
        IDisplayPreferencesManager displayPreferencesManager)
    {
        _authorizationContext = authorizationContext;
        _displayPreferencesManager = displayPreferencesManager;
    }

    /// <summary>Gets the current user's global Advanced Reader preferences.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ReaderPreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ReaderPreferencesDto>> GetPreferences()
    {
        var user = await GetCurrentUser().ConfigureAwait(false);
        if (user is null)
        {
            return Forbid();
        }

        var stored = _displayPreferencesManager.ListCustomItemDisplayPreferences(
            user.Id,
            PreferencesItemId,
            ClientName);

        stored.TryGetValue(LayoutKey, out var layout);
        stored.TryGetValue(DirectionKey, out var direction);
        stored.TryGetValue(FitKey, out var fit);
        stored.TryGetValue(ZoomKey, out var zoomText);

        var zoom = ReaderPreferenceRules.DefaultZoom;
        if (!string.IsNullOrWhiteSpace(zoomText)
            && double.TryParse(zoomText, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsedZoom))
        {
            zoom = ReaderPreferenceRules.NormalizeZoom(parsedZoom);
        }

        return Ok(new ReaderPreferencesDto(
            ReaderPreferenceRules.NormalizeLayout(layout),
            ReaderPreferenceRules.NormalizeDirection(direction),
            ReaderPreferenceRules.NormalizeFit(fit),
            zoom));
    }

    /// <summary>Replaces the current user's global Advanced Reader preferences.</summary>
    [HttpPut]
    [ProducesResponseType(typeof(ReaderPreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ReaderPreferencesDto>> UpdatePreferences(
        [FromBody] UpdateReaderPreferencesRequest request)
    {
        var user = await GetCurrentUser().ConfigureAwait(false);
        if (user is null)
        {
            return Forbid();
        }

        if (!ReaderPreferenceRules.IsValidLayout(request.Layout))
        {
            return InvalidPreference("layout", request.Layout);
        }

        if (!ReaderPreferenceRules.IsValidDirection(request.Direction))
        {
            return InvalidPreference("direction", request.Direction);
        }

        if (!ReaderPreferenceRules.IsValidFit(request.Fit))
        {
            return InvalidPreference("fit", request.Fit);
        }

        if (!ReaderPreferenceRules.IsValidZoom(request.Zoom))
        {
            return Problem(
                title: "Invalid reader preference",
                detail: $"Zoom must be between {ReaderPreferenceRules.MinimumZoom:P0} and {ReaderPreferenceRules.MaximumZoom:P0}.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var normalizedZoom = ReaderPreferenceRules.NormalizeZoom(request.Zoom);
        var values = new Dictionary<string, string?>
        {
            [LayoutKey] = request.Layout,
            [DirectionKey] = request.Direction,
            [FitKey] = request.Fit,
            [ZoomKey] = normalizedZoom.ToString("0.00", CultureInfo.InvariantCulture)
        };

        _displayPreferencesManager.SetCustomItemDisplayPreferences(
            user.Id,
            PreferencesItemId,
            ClientName,
            values);

        return Ok(new ReaderPreferencesDto(
            request.Layout,
            request.Direction,
            request.Fit,
            normalizedZoom));
    }

    private async Task<User?> GetCurrentUser()
    {
        var authorizationInfo = await _authorizationContext
            .GetAuthorizationInfo(HttpContext)
            .ConfigureAwait(false);
        return authorizationInfo.User;
    }

    private ActionResult InvalidPreference(string name, string value)
    {
        return Problem(
            title: "Invalid reader preference",
            detail: $"Unsupported {name} value '{value}'.",
            statusCode: StatusCodes.Status400BadRequest);
    }
}
