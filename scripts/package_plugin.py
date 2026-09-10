#!/usr/bin/env python3
"""Create a deterministic Jellyfin plugin ZIP and checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ARTIFACT_NAMES = (
    "Jellyfin.Plugin.AdvancedBooks.dll",
    "Jellyfin.AdvancedBooks.Core.dll",
)
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+\.\d+$")
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def digest(path: Path, algorithm: str) -> str:
    hasher = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def write_checksum(path: Path, checksum: str) -> Path:
    checksum_path = path.with_name(path.name + f".{checksum}")
    checksum_path.write_text(
        f"{digest(path, checksum)}  {path.name}\n",
        encoding="utf-8",
        newline="\n",
    )
    return checksum_path


def package(input_dir: Path, output_dir: Path, version: str) -> dict[str, str]:
    if not VERSION_RE.fullmatch(version):
        raise ValueError(f"Version must have four numeric components: {version!r}")

    sources = [(name, input_dir / name) for name in ARTIFACT_NAMES]
    missing = [str(path) for _, path in sources if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing plugin build artifacts: " + ", ".join(missing))

    output_dir.mkdir(parents=True, exist_ok=True)
    package_path = output_dir / f"AdvancedBooks_{version}.zip"

    # Write only normalized root-level files. Fixed timestamps, permissions, ordering,
    # compression mode and compression level make the container reproducible when the
    # deterministic .NET build outputs are identical.
    with zipfile.ZipFile(package_path, "w") as archive:
        for name, source in sorted(sources):
            info = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.flag_bits |= 0x800
            archive.writestr(
                info,
                source.read_bytes(),
                compress_type=zipfile.ZIP_DEFLATED,
                compresslevel=9,
            )

    with zipfile.ZipFile(package_path, "r") as archive:
        members = archive.namelist()
        expected = sorted(ARTIFACT_NAMES)
        if members != expected:
            raise RuntimeError(f"Unexpected ZIP layout: {members!r}; expected {expected!r}")
        if any("/" in member or "\\" in member for member in members):
            raise RuntimeError("Jellyfin catalog package must contain plugin artifacts at ZIP root")
        bad_files = archive.testzip()
        if bad_files is not None:
            raise RuntimeError(f"ZIP integrity test failed for {bad_files}")

    md5_path = write_checksum(package_path, "md5")
    sha256_path = write_checksum(package_path, "sha256")

    return {
        "package": str(package_path),
        "md5": str(md5_path),
        "sha256": str(sha256_path),
        "version": version,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("artifacts"), type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()

    result = package(args.input_dir, args.output_dir, args.version)
    print(json.dumps(result, sort_keys=True))

    if args.github_output is not None:
        with args.github_output.open("a", encoding="utf-8", newline="\n") as output:
            for key, value in result.items():
                output.write(f"{key}={value}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
