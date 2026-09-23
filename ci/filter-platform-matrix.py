#!/usr/bin/env python3
"""Filter a GitHub Actions matrix include JSON by platform-arch keys.

Reads a JSON array from stdin. Each object must have "platform" and "arch".
Env PLATFORMS: comma-separated keys like win-x64,linux-arm64 (spaces ignored).
Empty PLATFORMS keeps every entry.

Writes a compact JSON array to stdout (for fromJSON / GITHUB_OUTPUT).
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    raw = sys.stdin.read()
    entries = json.loads(raw)
    if not isinstance(entries, list):
        print("filter-platform-matrix: expected a JSON array", file=sys.stderr)
        return 2

    platforms = os.environ.get("PLATFORMS", "").replace(" ", "")
    if not platforms:
        filtered = entries
    else:
        wanted = {p for p in platforms.split(",") if p}
        filtered = []
        for entry in entries:
            if not isinstance(entry, dict):
                print("filter-platform-matrix: entries must be objects", file=sys.stderr)
                return 2
            platform = entry.get("platform")
            arch = entry.get("arch")
            if not isinstance(platform, str) or not isinstance(arch, str):
                print(
                    "filter-platform-matrix: each entry needs string platform+arch",
                    file=sys.stderr,
                )
                return 2
            key = f"{platform}-{arch}"
            if key in wanted:
                filtered.append(entry)

    sys.stdout.write(json.dumps(filtered, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
