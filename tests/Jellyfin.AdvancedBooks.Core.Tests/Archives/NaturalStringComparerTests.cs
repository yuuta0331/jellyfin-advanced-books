using Jellyfin.AdvancedBooks.Core.Archives;
using Xunit;

namespace Jellyfin.AdvancedBooks.Core.Tests.Archives;

public sealed class NaturalStringComparerTests
{
    [Fact]
    public void SortsNumericRunsNaturally()
    {
        string[] pages = ["page10.jpg", "page2.jpg", "page1.jpg", "page02.jpg"];

        Array.Sort(pages, NaturalStringComparer.Instance);

        Assert.Equal(["page1.jpg", "page2.jpg", "page02.jpg", "page10.jpg"], pages);
    }

    [Fact]
    public void IsCaseInsensitiveForTextPortions()
    {
        Assert.Equal(0, NaturalStringComparer.Instance.Compare("PAGE1.JPG", "page1.jpg"));
    }
}
