using System.IO.Compression;
using Jellyfin.AdvancedBooks.Core.Archives;
using Xunit;

namespace Jellyfin.AdvancedBooks.Core.Tests.Archives;

public sealed class ZipBookArchiveReaderTests : IDisposable
{
    private readonly string _directory;

    public ZipBookArchiveReaderTests()
    {
        _directory = Path.Combine(Path.GetTempPath(), "advanced-books-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_directory);
    }

    [Fact]
    public void EnumeratesOnlyImagesInNaturalOrder()
    {
        var path = CreateArchive(
            "sample.cbz",
            ("page10.jpg", [10]),
            ("ComicInfo.xml", [1, 2, 3]),
            ("page2.JPG", [2]),
            ("page1.png", [1]));

        var info = new ZipBookArchiveReader().GetBookInfo(path);

        Assert.Equal("CBZ", info.Format);
        Assert.Collection(
            info.Pages,
            page => Assert.Equal("page1.png", page.Name),
            page => Assert.Equal("page2.JPG", page.Name),
            page => Assert.Equal("page10.jpg", page.Name));
        Assert.Equal([0, 1, 2], info.Pages.Select(page => page.Index));
    }

    [Fact]
    public void IgnoresMacOsMetadataEntriesThatLookLikeImages()
    {
        var path = CreateArchive(
            "metadata.cbz",
            ("page1.jpg", [1]),
            ("__MACOSX/._page1.jpg", [9]),
            ("folder/page2.png", [2]),
            ("folder/._page2.png", [8]));

        var info = new ZipBookArchiveReader().GetBookInfo(path);

        Assert.Collection(
            info.Pages,
            page => Assert.Equal("page1.jpg", page.Name),
            page => Assert.Equal("folder/page2.png", page.Name));
    }

    [Fact]
    public void RejectsTraversalEvenWhenEntryLooksLikeIgnoredMacMetadata()
    {
        var path = CreateArchive("bad-metadata.cbz", ("../__MACOSX/._page1.jpg", [1]));

        Assert.Throws<ArchiveSafetyException>(() => new ZipBookArchiveReader().GetBookInfo(path));
    }

    [Fact]
    public async Task OpensAndCopiesOnePageWithoutExtractingArchive()
    {
        var path = CreateArchive(
            "sample.cbz",
            ("page2.jpg", [2, 2, 2]),
            ("page1.jpg", [1, 1, 1]));

        using var lease = new ZipBookArchiveReader().OpenPage(path, 1);
        using var buffer = new MemoryStream();
        await lease.CopyToAsync(buffer);

        Assert.Equal("page2.jpg", lease.Page.Name);
        Assert.Equal([2, 2, 2], buffer.ToArray());
    }

    [Fact]
    public void RejectsParentDirectoryTraversalEntry()
    {
        var path = CreateArchive("bad.cbz", ("../page1.jpg", [1]));

        Assert.Throws<ArchiveSafetyException>(() => new ZipBookArchiveReader().GetBookInfo(path));
    }

    [Fact]
    public void RejectsArchiveWithTooManyEntries()
    {
        var path = CreateArchive(
            "many.cbz",
            ("1.jpg", [1]),
            ("2.jpg", [2]));
        var reader = new ZipBookArchiveReader(
            new ZipArchiveSafetyOptions
            {
                MaxArchiveEntries = 1,
                MaxPages = 10,
                MaxUncompressedPageBytes = 1024,
                MaxTotalUncompressedPageBytes = 4096,
                MaxCompressionRatio = 1000
            });

        Assert.Throws<ArchiveSafetyException>(() => reader.GetBookInfo(path));
    }

    [Fact]
    public void RejectsPageAboveConfiguredSizeLimit()
    {
        var path = CreateArchive("large.cbz", ("page.jpg", [1, 2, 3, 4]));
        var reader = new ZipBookArchiveReader(
            new ZipArchiveSafetyOptions
            {
                MaxArchiveEntries = 10,
                MaxPages = 10,
                MaxUncompressedPageBytes = 3,
                MaxTotalUncompressedPageBytes = 4096,
                MaxCompressionRatio = 1000
            });

        Assert.Throws<ArchiveSafetyException>(() => reader.GetBookInfo(path));
    }

    [Fact]
    public void RejectsPageAboveConfiguredCompressionRatio()
    {
        var path = Path.Combine(_directory, "ratio.cbz");
        using (var file = File.Create(path))
        using (var archive = new ZipArchive(file, ZipArchiveMode.Create))
        {
            var entry = archive.CreateEntry("page.png", CompressionLevel.SmallestSize);
            using var entryStream = entry.Open();
            entryStream.Write(new byte[64 * 1024]);
        }

        var reader = new ZipBookArchiveReader(
            new ZipArchiveSafetyOptions
            {
                MaxArchiveEntries = 10,
                MaxPages = 10,
                MaxUncompressedPageBytes = 128 * 1024,
                MaxTotalUncompressedPageBytes = 128 * 1024,
                MaxCompressionRatio = 2
            });

        Assert.Throws<ArchiveSafetyException>(() => reader.GetBookInfo(path));
    }

    [Theory]
    [InlineData("book.cbz", true)]
    [InlineData("book.CBZ", true)]
    [InlineData("book.zip", true)]
    [InlineData("book.cbr", false)]
    [InlineData("book.pdf", false)]
    public void ReportsSupportedArchiveExtensions(string path, bool expected)
    {
        Assert.Equal(expected, new ZipBookArchiveReader().CanRead(path));
    }

    public void Dispose()
    {
        Directory.Delete(_directory, recursive: true);
    }

    private string CreateArchive(
        string fileName,
        params (string Name, byte[] Content)[] entries)
    {
        var path = Path.Combine(_directory, fileName);
        using var file = File.Create(path);
        using var archive = new ZipArchive(file, ZipArchiveMode.Create);

        foreach (var (name, content) in entries)
        {
            var entry = archive.CreateEntry(name, CompressionLevel.NoCompression);
            using var entryStream = entry.Open();
            entryStream.Write(content);
        }

        return path;
    }
}
