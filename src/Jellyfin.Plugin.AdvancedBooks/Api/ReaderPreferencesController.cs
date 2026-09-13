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
    private const string SidePaddingKey = "sidePadding";
    private const string PageGapKey = "pageGap";
    private const string BackgroundKey = "background";
    private const string AnimateTransitionsKey = "animateTransitions";
    private const string TouchGesturesKey = "touchGestures";
    private const string ShowMetadataKey = "showMetadata";
    private const string ShowMetadataTitleKey = "showMetadataTitle";
    private const string ShowMetadataAuthorsKey = "showMetadataAuthors";
    private const string ShowMetadataSeriesKey = "showMetadataSeries";
    private const string ShowMetadataIssueKey = "showMetadataIssue";
    private const string ShowMetadataYearKey = "showMetadataYear";
    private const string AutoScrollMetadataKey = "autoScrollMetadata";
    private const string ShowPagePositionKey = "showPagePosition";
    private const string LanguageKey = "language";
    private const string PreferenceSchemaVersionKey = "schemaVersion";

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
        stored.TryGetValue(SidePaddingKey, out var sidePaddingText);
        stored.TryGetValue(PageGapKey, out var pageGapText);
        stored.TryGetValue(BackgroundKey, out var background);
        stored.TryGetValue(AnimateTransitionsKey, out var animateTransitionsText);
        stored.TryGetValue(TouchGesturesKey, out var touchGesturesText);
        stored.TryGetValue(ShowMetadataKey, out var showMetadataText);
        stored.TryGetValue(ShowMetadataTitleKey, out var showMetadataTitleText);
        stored.TryGetValue(ShowMetadataAuthorsKey, out var showMetadataAuthorsText);
        stored.TryGetValue(ShowMetadataSeriesKey, out var showMetadataSeriesText);
        stored.TryGetValue(ShowMetadataIssueKey, out var showMetadataIssueText);
        stored.TryGetValue(ShowMetadataYearKey, out var showMetadataYearText);
        stored.TryGetValue(AutoScrollMetadataKey, out var autoScrollMetadataText);
        stored.TryGetValue(ShowPagePositionKey, out var showPagePositionText);
        stored.TryGetValue(LanguageKey, out var language);
        stored.TryGetValue(PreferenceSchemaVersionKey, out var schemaVersionText);

        var schemaVersion = 1;
        if (!string.IsNullOrWhiteSpace(schemaVersionText)
            && int.TryParse(schemaVersionText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedSchemaVersion))
        {
            schemaVersion = parsedSchemaVersion;
        }

        var zoom = ReaderPreferenceRules.DefaultZoom;
        if (!string.IsNullOrWhiteSpace(zoomText)
            && double.TryParse(zoomText, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsedZoom))
        {
            zoom = ReaderPreferenceRules.NormalizeZoom(parsedZoom);
        }

        var sidePadding = ReaderPreferenceRules.DefaultSidePadding;
        if (!string.IsNullOrWhiteSpace(sidePaddingText)
            && int.TryParse(sidePaddingText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedSidePadding))
        {
            sidePadding = ReaderPreferenceRules.NormalizeSidePadding(parsedSidePadding);
        }

        var pageGap = ReaderPreferenceRules.DefaultPageGap;
        if (!string.IsNullOrWhiteSpace(pageGapText)
            && int.TryParse(pageGapText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedPageGap))
        {
            pageGap = ReaderPreferenceRules.NormalizePageGap(parsedPageGap);
        }

        var animateTransitions = ParseStoredBoolean(animateTransitionsText, ReaderPreferenceRules.DefaultAnimateTransitions);
        var touchGestures = ParseStoredBoolean(touchGesturesText, ReaderPreferenceRules.DefaultTouchGestures);
        var showMetadata = ParseStoredBoolean(showMetadataText, ReaderPreferenceRules.DefaultShowMetadata);
        var showMetadataTitle = ParseStoredBoolean(showMetadataTitleText, ReaderPreferenceRules.DefaultShowMetadataTitle);
        var showMetadataAuthors = ParseStoredBoolean(showMetadataAuthorsText, ReaderPreferenceRules.DefaultShowMetadataAuthors);
        var showMetadataSeries = ParseStoredBoolean(showMetadataSeriesText, ReaderPreferenceRules.DefaultShowMetadataSeries);
        var showMetadataIssue = ParseStoredBoolean(showMetadataIssueText, ReaderPreferenceRules.DefaultShowMetadataIssue);
        var showMetadataYear = ParseStoredBoolean(showMetadataYearText, ReaderPreferenceRules.DefaultShowMetadataYear);
        var autoScrollMetadata = ParseStoredBoolean(autoScrollMetadataText, ReaderPreferenceRules.DefaultAutoScrollMetadata);
        var showPagePosition = ParseStoredBoolean(showPagePositionText, ReaderPreferenceRules.DefaultShowPagePosition);

        var normalizedFit = ReaderPreferenceRules.NormalizeStoredFit(fit, schemaVersion);

        return Ok(new ReaderPreferencesDto(
            ReaderPreferenceRules.NormalizeLayout(layout),
            ReaderPreferenceRules.NormalizeDirection(direction),
            normalizedFit,
            zoom,
            sidePadding,
            pageGap,
            ReaderPreferenceRules.NormalizeBackground(background),
            animateTransitions,
            touchGestures,
            showMetadata,
            showMetadataTitle,
            showMetadataAuthors,
            showMetadataSeries,
            showMetadataIssue,
            showMetadataYear,
            autoScrollMetadata,
            showPagePosition,
            ReaderPreferenceRules.NormalizeLanguage(language)));
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

        if (!ReaderPreferenceRules.IsValidSidePadding(request.SidePadding))
        {
            return InvalidPreference("side padding", request.SidePadding.ToString(CultureInfo.InvariantCulture));
        }

        if (!ReaderPreferenceRules.IsValidPageGap(request.PageGap))
        {
            return InvalidPreference("page gap", request.PageGap.ToString(CultureInfo.InvariantCulture));
        }

        if (!ReaderPreferenceRules.IsValidBackground(request.Background))
        {
            return InvalidPreference("background", request.Background);
        }

        if (!ReaderPreferenceRules.IsValidLanguage(request.Language))
        {
            return InvalidPreference("language", request.Language);
        }

        var normalizedZoom = ReaderPreferenceRules.NormalizeZoom(request.Zoom);
        var values = new Dictionary<string, string?>
        {
            [LayoutKey] = request.Layout,
            [DirectionKey] = request.Direction,
            [FitKey] = request.Fit,
            [ZoomKey] = normalizedZoom.ToString("0.00", CultureInfo.InvariantCulture),
            [SidePaddingKey] = request.SidePadding.ToString(CultureInfo.InvariantCulture),
            [PageGapKey] = request.PageGap.ToString(CultureInfo.InvariantCulture),
            [BackgroundKey] = request.Background,
            [AnimateTransitionsKey] = request.AnimateTransitions.ToString(),
            [TouchGesturesKey] = request.TouchGestures.ToString(),
            [ShowMetadataKey] = request.ShowMetadata.ToString(),
            [ShowMetadataTitleKey] = request.ShowMetadataTitle.ToString(),
            [ShowMetadataAuthorsKey] = request.ShowMetadataAuthors.ToString(),
            [ShowMetadataSeriesKey] = request.ShowMetadataSeries.ToString(),
            [ShowMetadataIssueKey] = request.ShowMetadataIssue.ToString(),
            [ShowMetadataYearKey] = request.ShowMetadataYear.ToString(),
            [AutoScrollMetadataKey] = request.AutoScrollMetadata.ToString(),
            [ShowPagePositionKey] = request.ShowPagePosition.ToString(),
            [LanguageKey] = request.Language,
            [PreferenceSchemaVersionKey] = ReaderPreferenceRules.CurrentPreferenceSchemaVersion.ToString(CultureInfo.InvariantCulture)
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
            normalizedZoom,
            request.SidePadding,
            request.PageGap,
            request.Background,
            request.AnimateTransitions,
            request.TouchGestures,
            request.ShowMetadata,
            request.ShowMetadataTitle,
            request.ShowMetadataAuthors,
            request.ShowMetadataSeries,
            request.ShowMetadataIssue,
            request.ShowMetadataYear,
            request.AutoScrollMetadata,
            request.ShowPagePosition,
            request.Language));
    }

    private async Task<User?> GetCurrentUser()
    {
        var authorizationInfo = await _authorizationContext
            .GetAuthorizationInfo(HttpContext)
            .ConfigureAwait(false);
        return authorizationInfo.User;
    }

    private static bool ParseStoredBoolean(string? value, bool fallback)
        => !string.IsNullOrWhiteSpace(value) && bool.TryParse(value, out var parsed) ? parsed : fallback;

    private ActionResult InvalidPreference(string name, string value)
    {
        return Problem(
            title: "Invalid reader preference",
            detail: $"Unsupported {name} value '{value}'.",
            statusCode: StatusCodes.Status400BadRequest);
    }
}
