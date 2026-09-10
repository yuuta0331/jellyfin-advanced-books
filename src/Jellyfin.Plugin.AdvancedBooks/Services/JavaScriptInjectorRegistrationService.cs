using System.Reflection;
using System.Runtime.Loader;
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
    private const string ReaderResourceName = "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksReader.js";
    private const string ProgressResourceName = "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksProgress.js";
    private const string PreferencesResourceName = "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksPreferences.js";
    private const string NavigatorResourceName = "Jellyfin.Plugin.AdvancedBooks.Reader.advancedBooksNavigator.js";
    private const string ReaderScriptId = "jellyfin-advanced-books-reader";

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
            TryUnregister();
            return Task.CompletedTask;
        }

        TryRegister(plugin);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        TryUnregister();
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

            if (registerMethod is null)
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

            var script = LoadCombinedReaderScript();
            var version = typeof(Plugin).Assembly.GetName().Version?.ToString() ?? "0.0.0";
            var payloadJson = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["id"] = ReaderScriptId,
                ["name"] = "Advanced Books Reader",
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
                _logger.LogWarning("JavaScript Injector payload creation returned null.");
                return;
            }

            var result = registerMethod.Invoke(null, [payload]);
            if (result is bool success && success)
            {
                _logger.LogInformation("Registered the Advanced Books reader, progress, preferences and page navigator bridges with JavaScript Injector.");
            }
            else
            {
                _logger.LogWarning("JavaScript Injector rejected the Advanced Books reader registration.");
            }
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Failed to register the Advanced Books reader with JavaScript Injector.");
        }
    }

    private void TryUnregister()
    {
        var injectorAssembly = FindInjectorAssembly();
        if (injectorAssembly is null)
        {
            return;
        }

        try
        {
            var interfaceType = injectorAssembly.GetType(InjectorInterfaceTypeName, throwOnError: false);
            var unregisterMethod = interfaceType?.GetMethod(
                "UnregisterScript",
                BindingFlags.Public | BindingFlags.Static,
                binder: null,
                types: [typeof(string)],
                modifiers: null);

            unregisterMethod?.Invoke(null, [ReaderScriptId]);
        }
        catch (Exception exception)
        {
            _logger.LogDebug(exception, "Failed to unregister the Advanced Books reader script during shutdown.");
        }
    }

    private static Assembly? FindInjectorAssembly()
    {
        return AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(assembly =>
                string.Equals(assembly.GetName().Name, InjectorAssemblyName, StringComparison.OrdinalIgnoreCase));
    }

    private static string LoadCombinedReaderScript()
    {
        return string.Concat(
            LoadEmbeddedText(ReaderResourceName),
            Environment.NewLine,
            LoadEmbeddedText(ProgressResourceName),
            Environment.NewLine,
            LoadEmbeddedText(PreferencesResourceName),
            Environment.NewLine,
            LoadEmbeddedText(NavigatorResourceName));
    }

    private static string LoadEmbeddedText(string resourceName)
    {
        var assembly = typeof(JavaScriptInjectorRegistrationService).Assembly;
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded reader resource '{resourceName}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
