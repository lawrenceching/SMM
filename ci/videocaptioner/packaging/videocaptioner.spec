# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for VideoCaptioner CLI (no GUI).

SMM-owned packaging spec (copied into the upstream checkout during CI).


To build:
    pyinstaller videocaptioner.spec --noconfirm

After building, copy resource/ into dist/videocaptioner/:
    cp -r resource/subtitle_style dist/videocaptioner/resource/
    cp -r resource/fonts dist/videocaptioner/resource/
    mkdir -p dist/videocaptioner/resource/bin

Or use: python scripts/build_exe.py
"""

from pathlib import Path

# ── Discover prompt markdown files for LLM optimization/translation/split ─────
_PROJECT = Path(SPECPATH).parent  # SPECPATH is set by PyInstaller
_prompts_dir = _PROJECT / "videocaptioner" / "core" / "prompts"
_prompt_datas = []
if _prompts_dir.is_dir():
    for md_file in _prompts_dir.rglob("*.md"):
        rel = md_file.relative_to(_PROJECT)
        _prompt_datas.append((str(rel), str(rel.parent)))

# ── Analysis ────────────────────────────────────────────────────────────────
a = Analysis(
    ["videocaptioner/__main__.py"],
    pathex=[],
    binaries=[],
    datas=[
        *_prompt_datas,
        ("resource/subtitle_style", "resource/subtitle_style"),
        ("resource/fonts", "resource/fonts"),
        ("videocaptioner/resources/fonts", "videocaptioner/resources/fonts"),
    ],
    hiddenimports=[
        "tomli",
        "json_repair",
        "langdetect",
        "fontTools",
        "fontTools.ttLib",
        "PIL",
        "PIL.Image",
        "pydub",
        # httpx / openai stack (required even for bijian/jianying via whisper_api import side-effects)
        "httpx",
        "httpcore",
        "anyio",
        "h11",
        "sniffio",
        "certifi",
        "idna",
        "openai",
        "distro",
        "jiter",
        "pydantic",
        "pydantic_core",
        # bijian/jianying / shared runtime deps PyInstaller may miss
        "requests",
        "urllib3",
        "charset_normalizer",
        "diskcache",
        "platformdirs",
        "tenacity",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "videocaptioner.ui",
        "PyQt5",
        "qfluentwidgets",
        "modelscope",
        "GPUtil",
        "psutil",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="videocaptioner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="videocaptioner",
)
