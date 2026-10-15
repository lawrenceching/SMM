#!/usr/bin/env python3
"""Rewrite upstream pyproject.toml to drop GUI hard-deps for CLI packaging.

WEIFENG2333/VideoCaptioner v1.4.x lists PyQt5 / modelscope / etc. as required
dependencies. Those packages often lack wheels on linux-arm64 / win-arm64, so
`pip install -e .` fails while building SMM's headless PyInstaller bundle.

Run from the upstream checkout root (where pyproject.toml lives).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

GUI_DEPS = {
    "PyQt5",
    "PyQt-Fluent-Widgets",
    "modelscope",
    "psutil",
    "GPUtil",
}


def _dep_name(line: str) -> str | None:
    m = re.match(r'\s*"([A-Za-z0-9_.-]+)', line)
    return m.group(1) if m else None


def strip_gui_deps(text: str) -> str:
    in_deps = False
    out: list[str] = []
    for line in text.splitlines(keepends=True):
        if line.startswith("dependencies = ["):
            in_deps = True
            out.append(line)
            continue
        if in_deps:
            if line.strip() == "]":
                in_deps = False
                out.append(line)
                continue
            name = _dep_name(line)
            if name and name in GUI_DEPS:
                continue
            out.append(line)
            continue
        out.append(line)
    return "".join(out)


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "pyproject.toml")
    original = path.read_text(encoding="utf-8")
    updated = strip_gui_deps(original)
    if updated == original:
        print(f"No GUI deps removed from {path}", file=sys.stderr)
        return 1
    path.write_text(updated, encoding="utf-8")
    print(f"Stripped GUI hard-deps from {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
