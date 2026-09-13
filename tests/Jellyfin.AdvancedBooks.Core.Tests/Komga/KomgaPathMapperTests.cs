using Jellyfin.AdvancedBooks.Core.Komga;
using Xunit;

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

    [Theory]
    [InlineData("file:/data/manga/A%20B.cbz", "/data/manga/A B.cbz")]
    [InlineData("file:///data/manga/A%20B.cbz", "/data/manga/A B.cbz")]
    [InlineData("file:/G:/Books/A%20B.cbz", "G:/Books/A B.cbz")]
    [InlineData("file:///G:/Books/A%20B.cbz", "G:/Books/A B.cbz")]
    [InlineData("G:/Books/A%20B.cbz", "G:/Books/A B.cbz")]
    [InlineData(@"G:\\Books\\A%20B.cbz", "G:/Books/A B.cbz")]
    public void ParsesFilePathsIndependentlyOfHostOperatingSystem(string input, string expected)
    {
        Assert.True(KomgaPathMapper.TryMapBookUrl(
            input,
            string.Empty,
            false,
            out var mapped));
        Assert.Equal(expected, mapped);
    }

    [Fact]
    public void PreservesUncFileUri()
    {
        Assert.True(KomgaPathMapper.TryMapBookUrl(
            "file://server/share/Books/A.cbz",
            "//server/share => Z:/Books",
            false,
            out var mapped));
        Assert.Equal("Z:/Books/Books/A.cbz", mapped);
    }

    [Theory]
    [InlineData("/data/A.cbz", "/ => G:/Books", "G:/Books/data/A.cbz")]
    [InlineData("G:/A.cbz", "G:/ => /books", "/books/A.cbz")]
    [InlineData("file://server/share/A.cbz", "//server/share => Z:/Mirror", "Z:/Mirror/A.cbz")]
    public void MapsFilesystemRootsWithoutDroppingSeparators(string input, string mappings, string expected)
    {
        Assert.True(KomgaPathMapper.TryMapBookUrl(
            input,
            mappings,
            false,
            out var mapped));
        Assert.Equal(expected, mapped);
    }

    [Theory]
    [InlineData("G:/", "G:/")]
    [InlineData(@"G:\\", "G:/")]
    [InlineData("//server/share//Books/A.cbz", "//server/share/Books/A.cbz")]
    public void NormalizesDriveAndUncPathsWithoutDestroyingRoots(string input, string expected)
    {
        Assert.Equal(expected, KomgaPathMapper.NormalizeComparablePath(input));
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
