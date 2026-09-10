using Jellyfin.AdvancedBooks.Core.Archives;
using Jellyfin.Plugin.AdvancedBooks.Resolvers;
using Jellyfin.Plugin.AdvancedBooks.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Controller.Resolvers;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.AdvancedBooks;

/// <summary>
/// Registers Advanced Books services with Jellyfin.
/// </summary>
public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<IItemResolver, OneShotBookResolver>();
        serviceCollection.AddSingleton<IZipBookArchiveReader, ZipBookArchiveReader>();
        serviceCollection.AddSingleton<IReaderThumbnailService, ReaderThumbnailService>();
        serviceCollection.AddHostedService<JavaScriptInjectorRegistrationService>();
    }
}
