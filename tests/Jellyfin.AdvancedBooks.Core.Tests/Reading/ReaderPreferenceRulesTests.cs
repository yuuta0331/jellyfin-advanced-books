using Jellyfin.AdvancedBooks.Core.Reading;

namespace Jellyfin.AdvancedBooks.Core.Tests.Reading;

public sealed class ReaderPreferenceRulesTests
{
    [Theory]
    [InlineData("single")]
    [InlineData("double")]
    [InlineData("vertical")]
    [InlineData("webtoon")]
    public void LayoutValues_AcceptSupportedModes(string value)
    {
        Assert.True(ReaderPreferenceRules.IsValidLayout(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeLayout(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("spread")]
    [InlineData("SINGLE")]
    public void LayoutValues_FallBackForUnknownModes(string? value)
    {
        Assert.False(ReaderPreferenceRules.IsValidLayout(value));
        Assert.Equal(ReaderPreferenceRules.DefaultLayout, ReaderPreferenceRules.NormalizeLayout(value));
    }

    [Theory]
    [InlineData("rtl")]
    [InlineData("ltr")]
    public void DirectionValues_AcceptSupportedModes(string value)
    {
        Assert.True(ReaderPreferenceRules.IsValidDirection(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeDirection(value));
    }

    [Theory]
    [InlineData("screen")]
    [InlineData("width")]
    [InlineData("height")]
    [InlineData("original")]
    public void FitValues_AcceptSupportedModes(string value)
    {
        Assert.True(ReaderPreferenceRules.IsValidFit(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeFit(value));
    }

    [Theory]
    [InlineData(0.5, 0.5)]
    [InlineData(1.0, 1.0)]
    [InlineData(1.14, 1.15)]
    [InlineData(1.16, 1.15)]
    [InlineData(3.99, 4.0)]
    [InlineData(4.0, 4.0)]
    public void NormalizeZoom_UsesFivePercentGrid(double value, double expected)
    {
        Assert.True(ReaderPreferenceRules.IsValidZoom(value));
        Assert.Equal(expected, ReaderPreferenceRules.NormalizeZoom(value), 5);
    }

    [Theory]
    [InlineData(0.49)]
    [InlineData(4.01)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    public void NormalizeZoom_FallsBackWhenOutsideRange(double value)
    {
        Assert.False(ReaderPreferenceRules.IsValidZoom(value));
        Assert.Equal(ReaderPreferenceRules.DefaultZoom, ReaderPreferenceRules.NormalizeZoom(value));
    }
}
