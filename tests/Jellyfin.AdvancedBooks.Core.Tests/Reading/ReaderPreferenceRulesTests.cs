using Jellyfin.AdvancedBooks.Core.Reading;
using Xunit;

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

    [Fact]
    public void DefaultFit_IsScreen()
    {
        Assert.Equal("screen", ReaderPreferenceRules.DefaultFit);
    }

    [Fact]
    public void LegacyHeightFit_MigratesToScreen()
    {
        Assert.Equal(
            ReaderPreferenceRules.DefaultFit,
            ReaderPreferenceRules.NormalizeStoredFit("height", 1));
    }

    [Fact]
    public void CurrentHeightFit_RemainsExplicitChoice()
    {
        Assert.Equal(
            "height",
            ReaderPreferenceRules.NormalizeStoredFit(
                "height",
                ReaderPreferenceRules.CurrentPreferenceSchemaVersion));
    }

    [Fact]
    public void SchemaV2HeightFit_RemainsExplicitChoiceAfterLaterSchemas()
    {
        Assert.Equal("height", ReaderPreferenceRules.NormalizeStoredFit("height", 2));
    }

    [Fact]
    public void MetadataPreferences_DefaultToVisibleAndAutoScrolling()
    {
        Assert.Equal(5, ReaderPreferenceRules.CurrentPreferenceSchemaVersion);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadata);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadataTitle);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadataAuthors);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadataSeries);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadataIssue);
        Assert.True(ReaderPreferenceRules.DefaultShowMetadataYear);
        Assert.True(ReaderPreferenceRules.DefaultAutoScrollMetadata);
    }

    [Theory]
    [InlineData("auto")]
    [InlineData("en")]
    [InlineData("ja")]
    [InlineData("de")]
    [InlineData("fr")]
    [InlineData("es")]
    [InlineData("zh-CN")]
    public void LanguageValues_AcceptSupportedValues(string value)
    {
        Assert.True(ReaderPreferenceRules.IsValidLanguage(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeLanguage(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("it")]
    [InlineData("zh-cn")]
    public void LanguageValues_FallBackToAutomaticForUnsupportedValues(string? value)
    {
        Assert.False(ReaderPreferenceRules.IsValidLanguage(value));
        Assert.Equal(ReaderPreferenceRules.DefaultLanguage, ReaderPreferenceRules.NormalizeLanguage(value));
    }

    [Theory]
    [InlineData("black")]
    [InlineData("gray")]
    [InlineData("white")]
    public void BackgroundValues_AcceptSupportedValues(string value)
    {
        Assert.True(ReaderPreferenceRules.IsValidBackground(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeBackground(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("sepia")]
    public void BackgroundValues_FallBackForUnsupportedValues(string? value)
    {
        Assert.False(ReaderPreferenceRules.IsValidBackground(value));
        Assert.Equal(ReaderPreferenceRules.DefaultBackground, ReaderPreferenceRules.NormalizeBackground(value));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(5)]
    [InlineData(10)]
    [InlineData(15)]
    [InlineData(20)]
    public void SidePadding_AcceptsSupportedValues(int value)
    {
        Assert.True(ReaderPreferenceRules.IsValidSidePadding(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizeSidePadding(value));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1)]
    [InlineData(25)]
    public void SidePadding_FallsBackForUnsupportedValues(int value)
    {
        Assert.False(ReaderPreferenceRules.IsValidSidePadding(value));
        Assert.Equal(ReaderPreferenceRules.DefaultSidePadding, ReaderPreferenceRules.NormalizeSidePadding(value));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(8)]
    [InlineData(12)]
    [InlineData(16)]
    [InlineData(24)]
    [InlineData(32)]
    public void PageGap_AcceptsSupportedValues(int value)
    {
        Assert.True(ReaderPreferenceRules.IsValidPageGap(value));
        Assert.Equal(value, ReaderPreferenceRules.NormalizePageGap(value));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(6)]
    [InlineData(64)]
    public void PageGap_FallsBackForUnsupportedValues(int value)
    {
        Assert.False(ReaderPreferenceRules.IsValidPageGap(value));
        Assert.Equal(ReaderPreferenceRules.DefaultPageGap, ReaderPreferenceRules.NormalizePageGap(value));
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
