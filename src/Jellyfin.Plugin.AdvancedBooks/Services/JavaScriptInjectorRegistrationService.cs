using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AdvancedBooks.Services;

/// <summary>
/// Registers the Advanced Books Web reader scripts with the optional JavaScript Injector plugin.
/// </summary>
public sealed class JavaScriptInjectorRegistrationService : IHostedService
{
    private const string InjectorAssemblyName = "Jellyfin.Plugin.JavaScriptInjector";
    private const string InjectorInterfaceTypeName = "Jellyfin.Plugin.JavaScriptInjector.PluginInterface";
    private const string LegacyCombinedScriptId = "jellyfin-advanced-books-reader";
    private const int MaximumRegisteredScriptUtf8Bytes = 96 * 1024;

    private static readonly ScriptRegistration[] ReaderScripts =
    [
        new(
            "jellyfin-advanced-books-reader-core",
            "Advanced Books Reader - Core",
            "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksReader.js"),
        new(
            "jellyfin-advanced-books-reader-progress",
            "Advanced Books Reader - Progress",
            "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksProgress.js"),
        new(
            "jellyfin-advanced-books-reader-preferences",
            "Advanced Books Reader - Preferences",
            "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksPreferences.js"),
        new(
            "jellyfin-advanced-books-reader-navigator",
            "Advanced Books Reader - Navigator",
            "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksNavigator.js"),
        new(
            "jellyfin-advanced-books-reader-gestures",
            "Advanced Books Reader - Gestures",
            "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksGestures.js")
    ];

    private static readonly UTF8Encoding StrictUtf8 = new(
        encoderShouldEmitUTF8Identifier: false,
        throwOnInvalidBytes: true);

    private readonly ILogger<JavaScriptInjectorRegistrationService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="JavaScriptInjectorRegistrationService"/> class.
    /// </summary>
    public JavaScriptInjectorRegistrationService(ILogger<JavaScriptInjectorRegistrationService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var plugin = Plugin.Instance;
        if (plugin is null)
        {
            _logger.LogWarning("Advanced Books plugin instance is unavailable; reader integration was not registered.");
            return Task.CompletedTask;
        }

        if (!plugin.Configuration.EnableAdvancedReader)
        {
            TryUnregister(plugin.Id.ToString());
            return Task.CompletedTask;
        }

        TryRegister(plugin);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        var pluginId = Plugin.Instance?.Id.ToString();
        if (!string.IsNullOrWhiteSpace(pluginId))
        {
            TryUnregister(pluginId);
        }

        return Task.CompletedTask;
    }

    private void TryRegister(Plugin plugin)
    {
        var injectorAssembly = FindInjectorAssembly();
        if (injectorAssembly is null)
        {
            _logger.LogInformation(
                "JavaScript Injector is not installed or loaded. The Advanced Books server APIs remain available, but the reader button will not be injected into Jellyfin Web.");
            return;
        }

        try
        {
            var interfaceType = injectorAssembly.GetType(InjectorInterfaceTypeName, throwOnError: false);
            var registerMethod = interfaceType?
                .GetMethods(BindingFlags.Public | BindingFlags.Static)
                .FirstOrDefault(method =>
                    string.Equals(method.Name, "RegisterScript", StringComparison.Ordinal)
                    && method.GetParameters().Length == 1);

            if (interfaceType is null || registerMethod is null)
            {
                _logger.LogWarning("JavaScript Injector does not expose the expected RegisterScript interface.");
                return;
            }

            var payloadType = registerMethod.GetParameters()[0].ParameterType;
            var parseMethod = payloadType.GetMethod(
                "Parse",
                BindingFlags.Public | BindingFlags.Static,
                binder: null,
                types: [typeof(string)],
                modifiers: null);

            if (parseMethod is null)
            {
                _logger.LogWarning("Could not construct a JavaScript Injector registration payload.");
                return;
            }

            // Remove the old single, very large registration first. Splitting the reader into
            // independent registrations keeps each payload comfortably bounded and prevents one
            // damaged script entry from invalidating the complete reader bundle.
            TryUnregister(interfaceType, plugin.Id.ToString());

            var version = typeof(Plugin).Assembly.GetName().Version?.ToString() ?? "0.0.0";
            var registeredIds = new List<string>(ReaderScripts.Length);

            foreach (var registration in ReaderScripts)
            {
                var script = LoadAndValidateEmbeddedScript(registration);
                var payloadJson = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["id"] = registration.Id,
                    ["name"] = registration.Name,
                    ["script"] = script,
                    ["enabled"] = true,
                    ["requiresAuthentication"] = true,
                    ["pluginId"] = plugin.Id.ToString(),
                    ["pluginName"] = plugin.Name,
                    ["pluginVersion"] = version
                });

                var payload = parseMethod.Invoke(null, [payloadJson]);
                if (payload is null)
                {
                    throw new InvalidOperationException(
                        $"JavaScript Injector payload creation returned null for '{registration.Id}'.");
                }

                var result = registerMethod.Invoke(null, [payload]);
                if (result is not bool success || !success)
                {
                    throw new InvalidOperationException(
                        $"JavaScript Injector rejected reader script '{registration.Id}'.");
                }

                registeredIds.Add(registration.Id);
                _logger.LogDebug(
                    "Registered Advanced Books reader script {ScriptId}: {Utf8Bytes} UTF-8 bytes, SHA-256 {Sha256}.",
                    registration.Id,
                    StrictUtf8.GetByteCount(script),
                    ComputeSha256Prefix(script));
            }

            _logger.LogInformation(
                "Registered {Count} Advanced Books reader scripts with JavaScript Injector as independent bounded entries.",
                registeredIds.Count);
        }
        catch (Exception exception)
        {
            // A partial reader is worse than no reader: dependent bridges could attach to a
            // mismatched core script. Roll back every plugin-owned registration on failure.
            TryUnregister(plugin.Id.ToString());
            _logger.LogWarning(exception, "Failed to register the Advanced Books reader with JavaScript Injector.");
        }
    }

    private void TryUnregister(string pluginId)
    {
        var injectorAssembly = FindInjectorAssembly();
        var interfaceType = injectorAssembly?.GetType(InjectorInterfaceTypeName, throwOnError: false);
        if (interfaceType is not null)
        {
            TryUnregister(interfaceType, pluginId);
        }
    }

    private void TryUnregister(Type interfaceType, string pluginId)
    {
        try
        {
            var unregisterAllMethod = interfaceType.GetMethod(
                "UnregisterAllScriptsFromPlugin",
                BindingFlags.Public | BindingFlags.Static,
                binder: null,
                types: [typeof(string)],
                modifiers: null);

            if (unregisterAllMethod is not null)
            {
                unregisterAllMethod.Invoke(null, [pluginId]);
                return;
            }

            var unregisterMethod = interfaceType.GetMethod(
                "UnregisterScript",
                BindingFlags.Public | BindingFlags.Static,
                binder: null,
                types: [typeof(string)],
                modifiers: null);

            if (unregisterMethod is null)
            {
                return;
            }

            unregisterMethod.Invoke(null, [LegacyCombinedScriptId]);
            foreach (var registration in ReaderScripts)
            {
                unregisterMethod.Invoke(null, [registration.Id]);
            }
        }
        catch (Exception exception)
        {
            _logger.LogDebug(exception, "Failed to unregister Advanced Books reader scripts.");
        }
    }

    private static Assembly? FindInjectorAssembly()
    {
        return AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(assembly =>
                string.Equals(assembly.GetName().Name, InjectorAssemblyName, StringComparison.OrdinalIgnoreCase));
    }

    private static string LoadAndValidateEmbeddedScript(ScriptRegistration registration)
    {
        var assembly = typeof(JavaScriptInjectorRegistrationService).Assembly;
        using var stream = assembly.GetManifestResourceStream(registration.ResourceName)
            ?? throw new InvalidOperationException(
                $"Embedded reader resource '{registration.ResourceName}' was not found.");
        using var reader = new StreamReader(
            stream,
            StrictUtf8,
            detectEncodingFromByteOrderMarks: true,
            bufferSize: 4096,
            leaveOpen: false);

        var script = reader.ReadToEnd();
        if (string.IsNullOrWhiteSpace(script))
        {
            throw new InvalidOperationException(
                $"Embedded reader resource '{registration.ResourceName}' is empty.");
        }

        var utf8Bytes = StrictUtf8.GetByteCount(script);
        if (utf8Bytes > MaximumRegisteredScriptUtf8Bytes)
        {
            throw new InvalidOperationException(
                $"Reader resource '{registration.ResourceName}' is {utf8Bytes} UTF-8 bytes, exceeding the defensive per-script limit of {MaximumRegisteredScriptUtf8Bytes} bytes. Split the reader asset before registering it.");
        }

        foreach (var character in script)
        {
            if (character == '\t' || character == '\r' || character == '\n')
            {
                continue;
            }

            if (char.IsControl(character))
            {
                throw new InvalidOperationException(
                    $"Reader resource '{registration.ResourceName}' contains an unexpected control character U+{(int)character:X4}.");
            }
        }

        return script;
    }

    private static string ComputeSha256Prefix(string script)
    {
        var hash = SHA256.HashData(StrictUtf8.GetBytes(script));
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }

    private sealed record ScriptRegistration(string Id, string Name, string ResourceName);
}
