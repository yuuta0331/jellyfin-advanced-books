using System.Buffers.Binary;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text;

const int maximumUtf8Bytes = 96 * 1024;

var expectedResources = new HashSet<string>(StringComparer.Ordinal)
{
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksLocalization.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksZoom.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksReader.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksProgress.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksPreferences.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksNavigator.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksGestures.js",
    "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksIntegration.js"
};

if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine(
        "Usage: EmbeddedReaderResourceVerifier <Jellyfin.Plugin.AdvancedBooks.dll> [expected-assembly-version]");
    return 2;
}

var assemblyPath = Path.GetFullPath(args[0]);
if (!File.Exists(assemblyPath))
{
    Console.Error.WriteLine($"Assembly not found: {assemblyPath}");
    return 2;
}

using var stream = File.OpenRead(assemblyPath);
using var peReader = new PEReader(stream);
if (!peReader.HasMetadata)
{
    Console.Error.WriteLine($"Assembly has no managed metadata: {assemblyPath}");
    return 1;
}

var metadata = peReader.GetMetadataReader();
var assemblyDefinition = metadata.GetAssemblyDefinition();
var assemblyVersion = assemblyDefinition.Version.ToString();
Console.WriteLine($"Assembly version: {assemblyVersion}");

if (args.Length == 2
    && !string.Equals(assemblyVersion, args[1], StringComparison.Ordinal))
{
    Console.Error.WriteLine(
        $"Assembly version mismatch. Expected {args[1]}, actual {assemblyVersion}.");
    return 1;
}

var corHeader = peReader.PEHeaders.CorHeader;
if (corHeader is null || corHeader.ResourcesDirectory.Size <= 0)
{
    Console.Error.WriteLine("Managed resource directory is missing.");
    return 1;
}

var resourceBlock = peReader.GetSectionData(corHeader.ResourcesDirectory.RelativeVirtualAddress);
var strictUtf8 = new UTF8Encoding(
    encoderShouldEmitUTF8Identifier: false,
    throwOnInvalidBytes: true);
var found = new HashSet<string>(StringComparer.Ordinal);

foreach (var handle in metadata.ManifestResources)
{
    var resource = metadata.GetManifestResource(handle);
    if (!resource.Implementation.IsNil)
    {
        continue;
    }

    var name = metadata.GetString(resource.Name);
    if (!expectedResources.Contains(name))
    {
        continue;
    }

    var offset = checked((int)resource.Offset);
    var lengthBytes = resourceBlock.GetContent(offset, sizeof(int));
    if (lengthBytes.Length != sizeof(int))
    {
        Console.Error.WriteLine($"Resource {name} has an invalid length prefix.");
        return 1;
    }

    var byteLength = BinaryPrimitives.ReadInt32LittleEndian(lengthBytes.AsSpan());
    if (byteLength <= 0 || byteLength > maximumUtf8Bytes)
    {
        Console.Error.WriteLine(
            $"Resource {name} has invalid size {byteLength}; allowed range is 1..{maximumUtf8Bytes} bytes.");
        return 1;
    }

    var resourceBytes = resourceBlock.GetContent(offset + sizeof(int), byteLength);
    if (resourceBytes.Length != byteLength)
    {
        Console.Error.WriteLine(
            $"Resource {name} is truncated: expected {byteLength} bytes, found {resourceBytes.Length}.");
        return 1;
    }

    string script;
    try
    {
        script = strictUtf8.GetString(resourceBytes.AsSpan());
    }
    catch (DecoderFallbackException exception)
    {
        Console.Error.WriteLine(
            $"Resource {name} is not valid UTF-8: {exception.Message}");
        return 1;
    }

    foreach (var character in script)
    {
        if (character is '\t' or '\r' or '\n')
        {
            continue;
        }

        if (char.IsControl(character))
        {
            Console.Error.WriteLine(
                $"Resource {name} contains unexpected control character U+{(int)character:X4}.");
            return 1;
        }
    }

    found.Add(name);
    Console.WriteLine($"Validated {name}: {byteLength} UTF-8 bytes.");
}

var missing = expectedResources
    .Where(resource => !found.Contains(resource))
    .OrderBy(resource => resource, StringComparer.Ordinal)
    .ToArray();

if (missing.Length > 0)
{
    Console.Error.WriteLine(
        $"Missing embedded reader resources: {string.Join(", ", missing)}");
    return 1;
}

Console.WriteLine($"Validated all {found.Count} embedded reader resources.");
return 0;
