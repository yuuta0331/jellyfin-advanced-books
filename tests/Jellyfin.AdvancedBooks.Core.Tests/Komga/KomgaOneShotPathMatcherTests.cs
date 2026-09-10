using Jellyfin.AdvancedBooks.Core.Komga;
using Xunit;

namespace Jellyfin.AdvancedBooks.Core.Tests.Komga;

public sealed class KomgaOneShotPathMatcherTests
{
    [Theory]
    [InlineData("/data/books/Comics/_oneshots", "_oneshots", true)]
    [InlineData("/data/books/Comics/My weirdly named _oneshots", "_oneshots", true)]
    [InlineData("/data/books/Comics/Space Adventures/_oneshots", "_oneshots", true)]
    [InlineData("/data/books/Comics/regular-series", "_oneshots", false)]
    public void PlainMatcherMatchesAnywhereInDirectoryPath(
        string directoryPath,
        string configuredDirectory,
        bool expected)
    {
        Assert.Equal(
            expected,
            KomgaOneShotPathMatcher.IsMatch(directoryPath, configuredDirectory));
    }

    [Theory]
    [InlineData("/data/books/Comics/_oneshots", "/_oneshots", true)]
    [InlineData("/data/books/Comics/_oneshots-archive", "/_oneshots", true)]
    [InlineData("/data/books/Comics/My _oneshots", "/_oneshots", false)]
    [InlineData("/data/books/Comics/foo/_oneshots-extra/bar", "/_oneshots", true)]
    public void SlashPrefixedMatcherRequiresSegmentPrefix(
        string directoryPath,
        string configuredDirectory,
        bool expected)
    {
        Assert.Equal(
            expected,
            KomgaOneShotPathMatcher.IsMatch(directoryPath, configuredDirectory));
    }

    [Fact]
    public void WindowsSeparatorsAreNormalized()
    {
        Assert.True(
            KomgaOneShotPathMatcher.IsMatch(
                @"D:\Books\Manga\_oneshots",
                "_oneshots"));
    }

    [Fact]
    public void MatchingIsCaseInsensitiveByDefault()
    {
        Assert.True(
            KomgaOneShotPathMatcher.IsMatch(
                "/data/books/_ONESHOTS",
                "_oneshots"));
    }

    [Fact]
    public void MatchingCanBeCaseSensitive()
    {
        Assert.False(
            KomgaOneShotPathMatcher.IsMatch(
                "/data/books/_ONESHOTS",
                "_oneshots",
                caseSensitive: true));
    }

    [Theory]
    [InlineData(null, "_oneshots")]
    [InlineData("", "_oneshots")]
    [InlineData("/data/books", null)]
    [InlineData("/data/books", "")]
    [InlineData("/data/books", "/")]
    public void InvalidInputsDoNotMatch(string? directoryPath, string? configuredDirectory)
    {
        Assert.False(
            KomgaOneShotPathMatcher.IsMatch(directoryPath, configuredDirectory));
    }
}
