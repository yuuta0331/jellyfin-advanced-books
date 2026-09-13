#!/usr/bin/env python3
"""Validate direct Komga metadata synchronization invariants."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Configuration/PluginConfiguration.cs"
CLIENT = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Services/Komga/KomgaApiClient.cs"
SYNC = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Services/Komga/KomgaMetadataSyncService.cs"
TASK = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Services/Komga/KomgaMetadataSyncTask.cs"
POST_SCAN = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Services/Komga/KomgaMetadataPostScanTask.cs"
CONTROLLER = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Api/KomgaMetadataController.cs"
UI = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Configuration/configPage.html"
PATH_MAPPER = ROOT / "src/Jellyfin.AdvancedBooks.Core/Komga/KomgaPathMapper.cs"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> int:
    config = CONFIG.read_text(encoding="utf-8")
    client = CLIENT.read_text(encoding="utf-8")
    sync = SYNC.read_text(encoding="utf-8")
    task = TASK.read_text(encoding="utf-8")
    post_scan = POST_SCAN.read_text(encoding="utf-8")
    controller = CONTROLLER.read_text(encoding="utf-8")
    ui = UI.read_text(encoding="utf-8")
    path_mapper = PATH_MAPPER.read_text(encoding="utf-8")

    for name in (
        "EnableKomgaMetadataSync",
        "KomgaServerUrl",
        "KomgaApiKey",
        "KomgaUsername",
        "KomgaPassword",
        "KomgaPathMappings",
        "KomgaPathMatchCaseSensitive",
        "KomgaSyncAfterLibraryScan",
    ):
        require(name in config, f"Komga configuration is missing {name}")

    require('HttpMethod.Post' in client and '"api/v1/books/list?' in client,
            "Komga Book list must use the current POST /api/v1/books/list API")
    require('HttpMethod.Post' in client and '"api/v1/series/list?' in client,
            "Komga Series list must use the current POST /api/v1/series/list API")
    require('"X-API-Key"' in client and 'AuthenticationHeaderValue("Basic"' in client,
            "Komga client must support API-key and Basic authentication")
    require("MaximumPages" in client and "PageSize" in client,
            "Komga API pagination is not bounded")
    require("http/https URL without embedded credentials" in client,
            "Komga server URL validation is missing")

    require("KomgaPathMapper.TryMapBookUrl" in sync,
            "Komga synchronization is not anchored to mapped file paths")
    require("TryGetValue(mappedPath" in sync,
            "Komga synchronization does not require an exact Jellyfin path match")
    require("StringComparer.OrdinalIgnoreCase" in sync
            and "KomgaPathMatchCaseSensitive" in sync,
            "Komga path comparison does not support explicit case policy")
    require("SemaphoreSlim" in sync,
            "Concurrent Komga synchronization passes are not serialized")
    require("UpdateItemAsync" in sync and "ItemUpdateType.MetadataEdit" in sync,
            "Komga metadata changes are not persisted through Jellyfin")
    require("UpdatePeopleAsync" in sync,
            "Komga authors are not synchronized to Jellyfin people")
    require('ProviderIds' in sync and '"KomgaBook"' in sync and '"KomgaSeries"' in sync,
            "Stable Komga provider IDs are not persisted")
    require("SeriesPresentationUniqueKey" in sync,
            "Komga series grouping has no stable presentation key")
    require("GetSeriesAsync(configuration" in sync,
            "Series metadata is not loaded in a bounded paginated pass")
    require("GetSeriesAsync(" not in sync[sync.find("foreach (var komgaBook"):],
            "Komga synchronization performs N+1 Series API requests inside the Book loop")

    require("IScheduledTask" in task and "AdvancedBooksKomgaMetadataSync" in task,
            "Manual Komga scheduled task is missing")
    require("ILibraryPostScanTask" in post_scan and "KomgaSyncAfterLibraryScan" in post_scan,
            "Optional post-scan Komga synchronization is missing")

    require("PermissionKind.IsAdministrator" in controller,
            "Komga administrative actions are not restricted to Jellyfin administrators")
    require('HttpPost("Test")' in controller and 'HttpPost("Sync")' in controller,
            "Komga Test/Sync administrative endpoints are missing")

    require("EnableKomgaMetadataSync" in ui
            and "KomgaPathMappings" in ui
            and "KomgaTestConnection" in ui
            and "KomgaSyncNow" in ui,
            "Komga configuration UI is incomplete")
    require("ComicInfo.xml is not used" in ui,
            "Komga configuration does not make direct database/API behavior explicit")

    require("HasPrefixBoundary" in path_mapper
            and 'line.IndexOf("=>"' in path_mapper
            and "OrderByDescending" in path_mapper,
            "Komga path mapping does not enforce prefix boundaries/longest-match behavior")

    forbidden_sync = (
        "Contains(source.Title",
        "Contains(komgaBook",
        "Levenshtein",
        "Fuzzy",
        "ComicInfo",
    )
    for token in forbidden_sync:
        require(token not in sync, f"Unsafe/fallback Komga matching path returned: {token!r}")

    print("Validated direct Komga metadata synchronization invariants.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
