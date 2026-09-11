#!/usr/bin/env python3
"""Validate release metadata without adding a YAML dependency."""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

FOUR_PART_VERSION = re.compile(r"^\d+\.\d+\.\d+\.\d+$")


def read_yaml_scalar(path: Path, key: str) -> str:
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*:\s*[\"']?([^\"'\s]+)", re.MULTILINE)
    match = pattern.search(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"Could not find {key!r} in {path}")
    return match.group(1)


def read_yaml_folded_block(path: Path, key: str) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    start = None
    for index, line in enumerate(lines):
        if re.match(rf"^{re.escape(key)}\s*:\s*>\s*$", line):
            start = index + 1
            break
    if start is None:
        raise ValueError(f"Could not find folded block {key!r} in {path}")

    parts: list[str] = []
    for line in lines[start:]:
        if line and not line[0].isspace():
            break
        stripped = line.strip()
        if stripped:
            parts.append(stripped)
    if not parts:
        raise ValueError(f"Folded block {key!r} in {path} is empty")
    return " ".join(parts)


def normalize_version(value: str) -> str:
    parts = value.split(".")
    if not all(part.isdigit() for part in parts) or not 1 <= len(parts) <= 4:
        raise ValueError(f"Invalid numeric version: {value!r}")
    return ".".join(parts + ["0"] * (4 - len(parts)))


def load_metadata(build_yaml: Path, csproj: Path) -> dict[str, str]:
    build_version = read_yaml_scalar(build_yaml, "version")
    target_abi = read_yaml_scalar(build_yaml, "targetAbi")
    guid = read_yaml_scalar(build_yaml, "guid")
    image_url = read_yaml_scalar(build_yaml, "imageUrl")
    category = read_yaml_scalar(build_yaml, "category")
    changelog = read_yaml_folded_block(build_yaml, "changelog")

    root = ET.parse(csproj).getroot()
    csproj_version_node = root.find(".//Version")
    if csproj_version_node is None or not csproj_version_node.text:
        raise ValueError(f"Could not find <Version> in {csproj}")
    csproj_version = csproj_version_node.text.strip()

    normalized_build_version = normalize_version(build_version)
    normalized_csproj_version = normalize_version(csproj_version)
    if normalized_build_version != normalized_csproj_version:
        raise ValueError(
            "Version mismatch: "
            f"build.yaml={normalized_build_version}, csproj={normalized_csproj_version}"
        )
    if not FOUR_PART_VERSION.fullmatch(normalized_build_version):
        raise ValueError(f"Release version must normalize to four components: {build_version!r}")
    if not FOUR_PART_VERSION.fullmatch(target_abi):
        raise ValueError(f"targetAbi must have four numeric components: {target_abi!r}")
    if not image_url.startswith("https://"):
        raise ValueError("imageUrl must use HTTPS")
    if not re.search(r"\.(?:png|jpe?g|webp|svg)$", image_url, re.IGNORECASE):
        raise ValueError("imageUrl must end in a supported image filename")
    if category != "Books":
        raise ValueError(f"Advanced Books catalog category must be 'Books', got {category!r}")

    return {
        "version": normalized_build_version,
        "tag": f"v{normalized_build_version}",
        "target_abi": target_abi,
        "guid": guid,
        "image_url": image_url,
        "category": category,
        "changelog": changelog,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-yaml", default=Path("build.yaml"), type=Path)
    parser.add_argument(
        "--csproj",
        default=Path("src/Jellyfin.Plugin.AdvancedBooks/Jellyfin.Plugin.AdvancedBooks.csproj"),
        type=Path,
    )
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--changelog-output", type=Path)
    parser.add_argument("--print-version", action="store_true")
    args = parser.parse_args()

    metadata = load_metadata(args.build_yaml, args.csproj)
    if args.print_version:
        print(metadata["version"])
    else:
        print(json.dumps(metadata, sort_keys=True))

    if args.changelog_output is not None:
        args.changelog_output.parent.mkdir(parents=True, exist_ok=True)
        args.changelog_output.write_text(metadata["changelog"] + "\n", encoding="utf-8", newline="\n")

    if args.github_output is not None:
        with args.github_output.open("a", encoding="utf-8", newline="\n") as output:
            for key in ("version", "tag", "target_abi", "guid"):
                output.write(f"{key}={metadata[key]}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
