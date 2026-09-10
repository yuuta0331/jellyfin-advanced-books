from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import package_plugin  # noqa: E402
import update_manifest  # noqa: E402
import validate_release  # noqa: E402


class ReleasePackagingTests(unittest.TestCase):
    def test_current_release_metadata_is_consistent(self) -> None:
        metadata = validate_release.load_metadata(
            ROOT / "build.yaml",
            ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Jellyfin.Plugin.AdvancedBooks.csproj",
        )
        self.assertRegex(metadata["version"], r"^\d+\.\d+\.\d+\.\d+$")
        self.assertEqual(f"v{metadata['version']}", metadata["tag"])
        self.assertRegex(metadata["target_abi"], r"^\d+\.\d+\.\d+\.\d+$")
        self.assertTrue(metadata["changelog"])

    def test_package_is_reproducible_and_flat(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            input_dir = root / "input"
            input_dir.mkdir()
            (input_dir / "Jellyfin.Plugin.AdvancedBooks.dll").write_bytes(b"plugin-dll")
            (input_dir / "Jellyfin.AdvancedBooks.Core.dll").write_bytes(b"core-dll")

            first = package_plugin.package(input_dir, root / "first", "9.8.7.6")
            second = package_plugin.package(input_dir, root / "second", "9.8.7.6")
            first_zip = Path(first["package"])
            second_zip = Path(second["package"])

            self.assertEqual(first_zip.read_bytes(), second_zip.read_bytes())
            with zipfile.ZipFile(first_zip) as archive:
                self.assertEqual(
                    sorted(package_plugin.ARTIFACT_NAMES),
                    archive.namelist(),
                )
                self.assertIsNone(archive.testzip())

            self.assertEqual(
                hashlib.md5(first_zip.read_bytes(), usedforsecurity=False).hexdigest(),
                Path(first["md5"]).read_text(encoding="utf-8").split()[0],
            )
            self.assertEqual(
                hashlib.sha256(first_zip.read_bytes()).hexdigest(),
                Path(first["sha256"]).read_text(encoding="utf-8").split()[0],
            )

    def test_manifest_entry_uses_package_checksum_and_replaces_same_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            package = root / "AdvancedBooks_0.8.0.0.zip"
            package.write_bytes(b"release-package")
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps([
                    {
                        **update_manifest.PLUGIN_METADATA,
                        "versions": [
                            {
                                "version": "0.7.0.0",
                                "changelog": "Older",
                                "targetAbi": "12.0.0.0",
                                "sourceUrl": "https://example.invalid/old.zip",
                                "checksum": "old",
                                "timestamp": "2026-09-10T00:00:00Z",
                            }
                        ],
                    }
                ]),
                encoding="utf-8",
            )

            release = update_manifest.update_manifest(
                manifest_path=manifest,
                package_path=package,
                version="0.8.0.0",
                target_abi="12.0.0.0",
                source_url=(
                    "https://github.com/yuuta0331/jellyfin-advanced-books/releases/"
                    "download/v0.8.0.0/AdvancedBooks_0.8.0.0.zip"
                ),
                timestamp="2026-09-11T00:00:00Z",
                changelog="Pinch zoom",
            )
            expected_md5 = hashlib.md5(package.read_bytes(), usedforsecurity=False).hexdigest()
            self.assertEqual(expected_md5, release["checksum"])

            data = json.loads(manifest.read_text(encoding="utf-8"))
            versions = data[0]["versions"]
            self.assertEqual(["0.8.0.0", "0.7.0.0"], [entry["version"] for entry in versions])

            update_manifest.update_manifest(
                manifest_path=manifest,
                package_path=package,
                version="0.8.0.0",
                target_abi="12.0.0.0",
                source_url="https://example.invalid/replaced.zip",
                timestamp="2026-09-11T01:00:00Z",
                changelog="Replacement",
            )
            data = json.loads(manifest.read_text(encoding="utf-8"))
            versions = data[0]["versions"]
            self.assertEqual(2, len(versions))
            self.assertEqual("Replacement", versions[0]["changelog"])


if __name__ == "__main__":
    unittest.main()
