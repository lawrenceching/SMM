#!/usr/bin/env python3
"""Filter a GitHub Actions matrix include JSON by platform-arch keys.

Reads a JSON array from stdin. Each object must have "platform" and "arch".
Env PLATFORMS: comma-separated keys like win-x64,linux-arm64 (spaces ignored).
Empty PLATFORMS keeps every entry.

Optional skip flags (truthy: 1/true/yes/on, case-insensitive):
  SKIP_WINDOWS, SKIP_LINUX, SKIP_MACOS, SKIP_X86, SKIP_ARM64

Writes a compact JSON array to stdout (for fromJSON / GITHUB_OUTPUT).
"""
from __future__ import annotations

import json
import os
import sys


def _truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


def _apply_platform_keys(entries: list[object], platforms: str) -> list[object]:
    if not platforms:
        return entries

    wanted = {p for p in platforms.split(",") if p}
    filtered: list[object] = []
    for entry in entries:
        if not isinstance(entry, dict):
            print("filter-platform-matrix: entries must be objects", file=sys.stderr)
            raise SystemExit(2)
        platform = entry.get("platform")
        arch = entry.get("arch")
        if not isinstance(platform, str) or not isinstance(arch, str):
            print(
                "filter-platform-matrix: each entry needs string platform+arch",
                file=sys.stderr,
            )
            raise SystemExit(2)
        key = f"{platform}-{arch}"
        if key in wanted:
            filtered.append(entry)
    return filtered


def _apply_skip_flags(entries: list[object]) -> list[object]:
    skip_windows = _truthy("SKIP_WINDOWS")
    skip_linux = _truthy("SKIP_LINUX")
    skip_macos = _truthy("SKIP_MACOS")
    skip_x86 = _truthy("SKIP_X86")
    skip_arm64 = _truthy("SKIP_ARM64")

    filtered: list[object] = []
    for entry in entries:
        if not isinstance(entry, dict):
            print("filter-platform-matrix: entries must be objects", file=sys.stderr)
            raise SystemExit(2)
        platform = entry.get("platform")
        arch = entry.get("arch")
        if not isinstance(platform, str) or not isinstance(arch, str):
            print(
                "filter-platform-matrix: each entry needs string platform+arch",
                file=sys.stderr,
            )
            raise SystemExit(2)

        if skip_windows and platform == "win":
            continue
        if skip_linux and platform == "linux":
            continue
        if skip_macos and platform in ("mac", "macos", "darwin"):
            continue
        if skip_x86 and arch == "x64":
            continue
        if skip_arm64 and arch == "arm64":
            continue
        filtered.append(entry)
    return filtered


def main() -> int:
    raw = sys.stdin.read()
    entries = json.loads(raw)
    if not isinstance(entries, list):
        print("filter-platform-matrix: expected a JSON array", file=sys.stderr)
        return 2

    platforms = os.environ.get("PLATFORMS", "").replace(" ", "")
    filtered = _apply_platform_keys(entries, platforms)
    filtered = _apply_skip_flags(filtered)

    sys.stdout.write(json.dumps(filtered, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
