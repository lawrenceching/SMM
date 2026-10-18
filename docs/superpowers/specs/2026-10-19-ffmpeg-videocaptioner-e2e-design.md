# FFmpeg Convert + VideoCaptioner Jobs E2E

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

Core jobs `FfmpegConvertJob`, `TranscribeSubtitleJob`, `TranslateSubtitleJob`,
`SynthesizeSubtitleJob`, and `ProcessSubtitleJob` already have CLI (`smm convert|transcribe|translate|synthesize|process`)
and Web UI dialogs. End-to-end coverage is incomplete:

- Convert UI exists only under `apps/e2e/common/manual/ConvertVideoFormat.e2e.ts` and does not wait for output.
- Compress already has CI CLI + UI (`prepareVideoFile`, wait for `size > 0`).
- Videocaptioner paths are mostly manual or missing.

**Decisions (brainstorming):**

| Topic | Choice |
|-------|--------|
| CI placement | Default CI; skip when ffmpeg / VideoCaptioner binary missing; OHOS unsupported |
| VC happy paths | Shortest assertable path: process uses `--no-translate --no-synthesize`; translate uses inline `.srt` + `google`; synthesize uses video + inline `.srt` |
| Subtitle fixture | Write a minimal `.srt` in the test (no committed blob) |
| UI depth | Defaults only → Start/Confirm → wait for output (`size > 0`), same as compress |
| Layout | Two clusters + shared helpers (ffmpeg vs videocaptioner) |

**Success =** job/CLI exit success (or dialog closed without error) **and** expected output file exists with `size > 0`.
Missing binary → **skip**. Binary present but ASR / Google network fails → **fail**.

## 2. Architecture

### 2.1 Project Level

E2E only (`apps/e2e`). No production Core/CLI/UI behavior changes except optional `data-testid` for Process `noTranslate` if missing.

### 2.2 Shared helpers (`apps/e2e/test/lib/`)

| Helper | Role |
|--------|------|
| `prepareVideoFile` (existing) | Cache/download `sample.mp4` into target path |
| `prepareMinimalSrt(filepath)` (new) | Write a few fixed cue lines |
| `checkVideoCaptionerAvailable()` (new) | Detect `bin/videocaptioner` executable (same layout as CI `download-3pp-binary`) |
| Output wait (reuse Compress pattern) | Host `fs` and/or Docker `browser-fs` until `size > 0` |

ffmpeg availability: same as Compress (`ffmpeg -version`; Docker assumed available).

### 2.3 CLI e2e (`apps/e2e/cli/`)

| File | Command |
|------|---------|
| `convert.test.ts` | `smm convert <in> -o <out> --folder <dir> --format mp4h264 --preset balanced` |
| `transcribe.test.ts` | `smm transcribe <media> --folder <dir> --format srt` (default ASR `bijian`) |
| `translate.test.ts` | inline srt → `smm translate <srt> --folder <dir> --translator google --target-language en` |
| `synthesize.test.ts` | sample.mp4 + inline srt → `smm synthesize <video> -s <srt> --folder <dir>` |
| `process.test.ts` | `smm process <media> --folder <dir> --no-translate --no-synthesize` |

Each: temp work dir, `setup`/`cleanup` from `cli/base`, `skipIf` when required binary missing, timeout ~5–10 min (convert/synthesize up to ~10 min like compress).

### 2.4 Web UI e2e

| File | Entry | Assert |
|------|-------|--------|
| `common/ffmpeg/ConvertVideo.e2e.ts` | Music context menu → Format conversion | Read default output filename → Start → wait output; **supersedes** `manual/ConvertVideoFormat.e2e.ts` (remove or re-export once to avoid double run) |
| `common/videocaptioner/Transcribe.e2e.ts` | Context menu → Subtitle → Transcribe | Confirm → wait `sample.srt` |
| `common/videocaptioner/Translate.e2e.ts` | sample.mp4 + minimal srt; header Subtitle → Translate | Confirm defaults → wait translated subtitle artifact |
| `common/videocaptioner/Synthesize.e2e.ts` | same fixtures; header → Synthesize | Confirm → wait synthesized video |
| `common/videocaptioner/Process.e2e.ts` | header → Process | Enable **noTranslate** (UI already defaults **noSynthesize** true) → Confirm → wait `.srt` |

**Component objects:** extend `MusicPanel` labels for translate / synthesize / process as needed; add/use `data-testid` for Process noTranslate checkbox if absent.

### 2.5 Key design

```
prepareVideoFile / prepareMinimalSrt
        │
        ├─ CLI: smm <command> … → exit 0 → output size > 0
        │
        └─ UI: music folder import → open dialog → Confirm/Start
                 → dialog closes without error → output size > 0
```

Skip gates: `checkFfmpegAvailable` / `checkVideoCaptionerAvailable` / `skipIfOhos`.

## 3. User Stories

### 3.1 Convert CLI

* **Given** ffmpeg available and `sample.mp4` prepared
* **When** `smm convert` runs with `mp4h264` / `balanced`
* **Then** exit 0 and output file `size > 0`

### 3.2 Convert UI

* **Given** Music folder with `sample.mp4`
* **When** Format conversion dialog Start with defaults
* **Then** dialog closes without error and output file `size > 0`

### 3.3 Transcribe CLI / UI

* **Given** VideoCaptioner available and sample media
* **When** transcribe runs (CLI or UI Confirm)
* **Then** `{stem}.srt` exists with `size > 0`

### 3.4 Translate CLI / UI

* **Given** VC available, sample media, minimal inline `.srt`
* **When** translate with `google` → `en` (CLI or UI Confirm)
* **Then** translated subtitle artifact exists with `size > 0` (exact name discovered at implementation from VideoCaptioner output)

### 3.5 Synthesize CLI / UI

* **Given** VC available, sample video + minimal `.srt`
* **When** synthesize runs with defaults (soft)
* **Then** synthesized video exists with `size > 0`

### 3.6 Process CLI / UI (short path)

* **Given** VC available and sample media
* **When** CLI `process --no-translate --no-synthesize`, or UI Process with noTranslate checked (noSynthesize already default)
* **Then** transcription `.srt` exists with `size > 0`

## 4. Non-Goals

- Convert format dropdown / Custom tab; compress preset matrix; write-tags CLI
- Full process pipeline including translate + synthesize
- whisper-cpp / LLM / bing translator paths
- Committing `sample.mp4` into git; quality or size-ratio assertions
- HarmonyOS coverage

## 5. Other

- Timeouts: convert/synthesize ~8–10 min; transcribe/translate/process ~5–10 min
- knip: update `ignoreBinaries` if tests invoke `videocaptioner` / `ffmpeg` directly
- Docker: assume ffmpeg/VC present when binaries are baked in; otherwise skip via discovery
