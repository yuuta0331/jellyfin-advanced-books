using Jellyfin.AdvancedBooks.Core.Reading;
using Xunit;

namespace Jellyfin.AdvancedBooks.Core.Tests.Reading;

public sealed class ReaderProgressMathTests
{
    [Theory]
    [InlineData(0, 0L)]
    [InlineData(1, 10_000L)]
    [InlineData(37, 370_000L)]
    public void ToPlaybackPositionTicks_UsesJellyfinComicConvention(int pageIndex, long expected)
    {
        Assert.Equal(expected, ReaderProgressMath.ToPlaybackPositionTicks(pageIndex));
    }

    [Theory]
    [InlineData(0, 100)]
    [InlineData(1, 100)]
    [InlineData(37, 100)]
    [InlineData(99, 100)]
    public void SharedJellyfinComicPosition_RoundTripsBetweenReaders(int pageIndex, int pageCount)
    {
        var ticks = ReaderProgressMath.ToPlaybackPositionTicks(pageIndex);

        // Jellyfin Web ComicsPlayer restores with startPositionTicks / 10000.
        Assert.Equal((long)pageIndex, ticks / ReaderProgressMath.TicksPerPage);
        Assert.Equal(pageIndex, ReaderProgressMath.FromPlaybackPositionTicks(ticks, pageCount));
    }

    [Theory]
    [InlineData(0L, 100, 0)]
    [InlineData(10_000L, 100, 1)]
    [InlineData(990_000L, 100, 99)]
    [InlineData(5_000_000L, 100, 99)]
    [InlineData(-1L, 100, 0)]
    public void FromPlaybackPositionTicks_ClampsToAvailablePages(long ticks, int pageCount, int expected)
    {
        Assert.Equal(expected, ReaderProgressMath.FromPlaybackPositionTicks(ticks, pageCount));
    }

    [Theory]
    [InlineData(0, 4, 25d)]
    [InlineData(1, 4, 50d)]
    [InlineData(3, 4, 100d)]
    [InlineData(99, 4, 100d)]
    public void GetPercentage_ReportsReachedPage(int pageIndex, int pageCount, double expected)
    {
        Assert.Equal(expected, ReaderProgressMath.GetPercentage(pageIndex, pageCount), precision: 6);
    }

    [Fact]
    public void IsComplete_OnlyReturnsTrueAtOrAfterFinalPage()
    {
        Assert.False(ReaderProgressMath.IsComplete(8, 10));
        Assert.True(ReaderProgressMath.IsComplete(9, 10));
        Assert.True(ReaderProgressMath.IsComplete(10, 10));
        Assert.False(ReaderProgressMath.IsComplete(0, 0));
    }
}
