namespace Jellyfin.Plugin.AdvancedBooks.Services.Komga;

internal sealed class KomgaPage<T>
{
    public List<T> Content { get; set; } = [];

    public bool Last { get; set; }

    public int Number { get; set; }

    public int TotalPages { get; set; }
}

internal sealed class KomgaBookDto
{
    public string Id { get; set; } = string.Empty;

    public string SeriesId { get; set; } = string.Empty;

    public string SeriesTitle { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    public bool Deleted { get; set; }

    public KomgaBookMetadataDto Metadata { get; set; } = new();
}

internal sealed class KomgaBookMetadataDto
{
    public List<KomgaAuthorDto> Authors { get; set; } = [];

    public string Isbn { get; set; } = string.Empty;

    public string Number { get; set; } = string.Empty;

    public double NumberSort { get; set; }

    public DateTime? ReleaseDate { get; set; }

    public string Summary { get; set; } = string.Empty;

    public List<string> Tags { get; set; } = [];

    public string Title { get; set; } = string.Empty;
}

internal sealed class KomgaAuthorDto
{
    public string Name { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;
}

internal sealed class KomgaSeriesDto
{
    public string Id { get; set; } = string.Empty;

    public bool Deleted { get; set; }

    public KomgaSeriesMetadataDto Metadata { get; set; } = new();
}

internal sealed class KomgaSeriesMetadataDto
{
    public List<string> Genres { get; set; } = [];

    public string Language { get; set; } = string.Empty;

    public string Publisher { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public List<string> Tags { get; set; } = [];

    public string Title { get; set; } = string.Empty;

    public string TitleSort { get; set; } = string.Empty;

    public string ReadingDirection { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int? AgeRating { get; set; }
}
