using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Jellyfin.Plugin.AdvancedBooks.Configuration;

namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

internal interface IKomgaApiClient
{
    Task TestConnectionAsync(PluginConfiguration configuration, CancellationToken cancellationToken);

    Task<IReadOnlyList<KomgaBookDto>> GetBooksAsync(
        PluginConfiguration configuration,
        CancellationToken cancellationToken);

    Task<KomgaSeriesDto?> GetSeriesAsync(
        PluginConfiguration configuration,
        string seriesId,
        CancellationToken cancellationToken);
}

internal sealed class KomgaApiClient : IKomgaApiClient
{
    private const int PageSize = 250;
    private const int MaximumPages = 10000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IHttpClientFactory _httpClientFactory;

    public KomgaApiClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task TestConnectionAsync(
        PluginConfiguration configuration,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(
            configuration,
            HttpMethod.Post,
            "api/v1/books/list?page=0&size=1");
        request.Content = JsonContent();
        using var response = await SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    public async Task<IReadOnlyList<KomgaBookDto>> GetBooksAsync(
        PluginConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var result = new List<KomgaBookDto>();
        for (var page = 0; page < MaximumPages; page++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            using var request = CreateRequest(
                configuration,
                HttpMethod.Post,
                $"api/v1/books/list?page={page}&size={PageSize}&sort=url,asc");
            request.Content = JsonContent();

            using var response = await SendAsync(request, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            var payload = await JsonSerializer.DeserializeAsync<KomgaPage<KomgaBookDto>>(
                stream,
                JsonOptions,
                cancellationToken).ConfigureAwait(false)
                ?? throw new InvalidDataException("Komga returned an empty books response.");

            if (payload.Content.Count == 0)
            {
                break;
            }

            result.AddRange(payload.Content);
            if (payload.Last || payload.Content.Count < PageSize)
            {
                break;
            }

            if (page == MaximumPages - 1)
            {
                throw new InvalidDataException("Komga books pagination exceeded the safety limit.");
            }
        }

        return result;
    }

    public async Task<KomgaSeriesDto?> GetSeriesAsync(
        PluginConfiguration configuration,
        string seriesId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(seriesId))
        {
            return null;
        }

        using var request = CreateRequest(
            configuration,
            HttpMethod.Get,
            $"api/v1/series/{Uri.EscapeDataString(seriesId)}");
        using var response = await SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        return await JsonSerializer.DeserializeAsync<KomgaSeriesDto>(
            stream,
            JsonOptions,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("AdvancedBooks.Komga");
        return await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
    }

    private static HttpRequestMessage CreateRequest(
        PluginConfiguration configuration,
        HttpMethod method,
        string relativePath)
    {
        var baseUri = ParseBaseUri(configuration.KomgaServerUrl);
        var request = new HttpRequestMessage(method, new Uri(baseUri, relativePath));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (!string.IsNullOrWhiteSpace(configuration.KomgaApiKey))
        {
            request.Headers.TryAddWithoutValidation("X-API-Key", configuration.KomgaApiKey.Trim());
        }
        else if (!string.IsNullOrWhiteSpace(configuration.KomgaUsername))
        {
            var credentials = Convert.ToBase64String(
                Encoding.UTF8.GetBytes($"{configuration.KomgaUsername}:{configuration.KomgaPassword}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        }

        return request;
    }

    private static StringContent JsonContent()
        => new("{}", Encoding.UTF8, "application/json");

    private static Uri ParseBaseUri(string value)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var parsed)
            || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(parsed.UserInfo))
        {
            throw new InvalidOperationException(
                "Komga server URL must be an absolute http/https URL without embedded credentials.");
        }

        var text = parsed.AbsoluteUri.EndsWith("/", StringComparison.Ordinal)
            ? parsed.AbsoluteUri
            : parsed.AbsoluteUri + "/";
        return new Uri(text, UriKind.Absolute);
    }
}
