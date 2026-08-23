#!/usr/bin/env python3
"""Regenerate deterministic package inventory and SHA-256 receipts."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INVENTORY_PATH = ROOT / "FILE_INVENTORY.json"
CHECKSUM_PATH = ROOT / "CHECKSUMS_SHA256.txt"
EXCLUDED_FROM_INVENTORY = {"FILE_INVENTORY.json", "CHECKSUMS_SHA256.txt"}
EXCLUDED_FROM_CHECKSUMS = {"CHECKSUMS_SHA256.txt"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def files_excluding(names: set[str]) -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*")
        if path.is_file() and path.relative_to(ROOT).as_posix() not in names
    )


def build_inventory() -> None:
    files = files_excluding(EXCLUDED_FROM_INVENTORY)
    entries = []
    total_bytes = 0
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        size = path.stat().st_size
        total_bytes += size
        entries.append({"path": relative, "bytes": size, "sha256": sha256(path)})

    payload = {
        "schema": "axm.package-file-inventory/v1",
        "packageId": "AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3",
        "version": "0.11.3",
        "generatedUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fileCount": len(entries),
        "totalBytes": total_bytes,
        "inventoryExcludes": sorted(EXCLUDED_FROM_INVENTORY),
        "files": entries,
    }
    INVENTORY_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_checksums() -> None:
    lines = []
    for path in files_excluding(EXCLUDED_FROM_CHECKSUMS):
        lines.append(f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}")
    CHECKSUM_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build_inventory()
    build_checksums()
    print(f"Wrote {INVENTORY_PATH.relative_to(ROOT)} and {CHECKSUM_PATH.relative_to(ROOT)}")
