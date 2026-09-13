using Jellyfin.AdvancedBooks.Core.Komga;

namespace Jellyfin.AdvancedBooks.Core.Tests.Komga;

public sealed class KomgaPathMapperTests
{
    [Fact]
    public void MapsFileUriWithPrefix()
    {
        var ok = KomgaPathMapper.TryMapBookUrl(
            "file:/data/manga/Series/Volume%2001.cbz",
            "/data/manga => G:/Manga",
            false,
            out var mapped);

        Assert.True(ok);
        Assert.Equal("G:/Manga/Series/Volume 01.cbz", mapped);
    }

    [Fact]
    public void UsesLongestMappingPrefix()
    {
        var mappings = """
            /data => D:/Data
            /data/manga => E:/Books
            """;

        Assert.True(KomgaPathMapper.TryMapBookUrl(
            "file:/data/manga/A.cbz",
            mappings,
            true,
            out var mapped));
        Assert.Equal("E:/Books/A.cbz", mapped);
    }

    [Fact]
    public void DoesNotMatchPartialDirectorySegment()
    {
        Assert.True(KomgaPathMapper.TryMapBookUrl(
            "file:/data/mangaka/A.cbz",
            "/data/manga => /books",
            true,
            out var mapped));
        Assert.Equal("/data/mangaka/A.cbz", mapped);
    }

    [Fact]
    public void CanMatchPrefixCaseInsensitively()
    {
        Assert.True(KomgaPathMapper.TryMapBookUrl(
            "file:/DATA/Manga/A.cbz",
            "/data/manga => C:/Books",
            false,
            out var mapped));
        Assert.Equal("C:/Books/A.cbz", mapped);
    }

    [Fact]
    public void RejectsNonFileUrl()
    {
        Assert.False(KomgaPathMapper.TryMapBookUrl(
            "https://example.invalid/book.cbz",
            string.Empty,
            false,
            out _));
    }

    [Fact]
    public void NormalizesWindowsSeparators()
    {
        Assert.Equal("G:/Books/A.cbz", KomgaPathMapper.NormalizeComparablePath(@"G:\Books\A.cbz"));
    }

    [Fact]
    public void IgnoresCommentsAndMalformedMappings()
    {
        var mappings = KomgaPathMapper.ParseMappings("""
            # comment
            invalid
            /komga => /jellyfin
            """);

        var mapping = Assert.Single(mappings);
        Assert.Equal("/komga", mapping.Source);
        Assert.Equal("/jellyfin", mapping.Target);
    }
}
