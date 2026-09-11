#!/usr/bin/env python3
"""Add or replace one Advanced Books release in a Jellyfin repository manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

PLUGIN_GUID = "843f3c69-88ee-4e82-84f3-330b84d64d88"
PLUGIN_METADATA = {
    "guid": PLUGIN_GUID,
    "name": "Advanced Books",
    "description": (
        "Advanced comic, manga, magazine and book features for Jellyfin 12, including "
        "Komga-compatible One-Shots and a localized Advanced Reader."
    ),
    "overview": "Advanced comic, manga, magazine and book reader for Jellyfin 12.",
    "owner": "yuuta0331",
    "category": "Books",
    "imageUrl": "https://raw.githubusercontent.com/yuuta0331/jellyfin-advanced-books/main/assets/advanced-books-icon.png",
}


def md5(path: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_numeric_version(value: str) -> tuple[int, int, int, int]:
    parts = value.split(".")
    if len(parts) != 4 or not all(part.isdigit() for part in parts):
        raise ValueError(f"Version must have four numeric components: {value!r}")
    return tuple(int(part) for part in parts)  # type: ignore[return-value]


def validate_timestamp(value: str) -> str:
    if not value.endswith("Z"):
        raise ValueError("Timestamp must be UTC and end in Z")
    datetime.fromisoformat(value[:-1] + "+00:00")
    return value


def load_manifest(path: Path) -> list[dict]:
    if not path.exists():
        return [{**PLUGIN_METADATA, "versions": []}]
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Jellyfin repository manifest root must be an array")
    return data


def update_manifest(
    manifest_path: Path,
    package_path: Path,
    version: str,
    target_abi: str,
    source_url: str,
    timestamp: str,
    changelog: str,
) -> dict:
    parse_numeric_version(version)
    parse_numeric_version(target_abi)
    validate_timestamp(timestamp)
    if not package_path.is_file():
        raise FileNotFoundError(package_path)
    if not source_url.startswith("https://"):
        raise ValueError("sourceUrl must use HTTPS")

    manifest = load_manifest(manifest_path)
    plugin = next((entry for entry in manifest if entry.get("guid") == PLUGIN_GUID), None)
    if plugin is None:
        plugin = {**PLUGIN_METADATA, "versions": []}
        manifest.append(plugin)

    for key, value in PLUGIN_METADATA.items():
        plugin[key] = value

    versions = plugin.setdefault("versions", [])
    if not isinstance(versions, list):
        raise ValueError("Plugin versions must be an array")

    release = {
        "version": version,
        "changelog": changelog.strip(),
        "targetAbi": target_abi,
        "sourceUrl": source_url,
        "checksum": md5(package_path),
        "timestamp": timestamp,
    }
    versions[:] = [entry for entry in versions if entry.get("version") != version]
    versions.append(release)
    versions.sort(key=lambda entry: parse_numeric_version(str(entry["version"])), reverse=True)

    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return release


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=Path("manifest.json"), type=Path)
    parser.add_argument("--package", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--target-abi", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--changelog-file", required=True, type=Path)
    args = parser.parse_args()

    release = update_manifest(
        manifest_path=args.manifest,
        package_path=args.package,
        version=args.version,
        target_abi=args.target_abi,
        source_url=args.source_url,
        timestamp=args.timestamp,
        changelog=args.changelog_file.read_text(encoding="utf-8"),
    )
    print(json.dumps(release, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
