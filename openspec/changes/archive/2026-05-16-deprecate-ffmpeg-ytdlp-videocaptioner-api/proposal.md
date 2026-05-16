## Why

`apps/cli` maintains parallel HTTP surfaces for `ffmpeg`, `yt-dlp`, and `videocaptioner` alongside the existing **`POST /api/executeCmd`** whitelist runner. That duplicates spawn/logging logic, splits client code paths (some UI flows already use `executeCmdStream`, others use JSON wrapper routes), and makes new tool features land twice. Consolidating on `executeCmd` gives one execution model (streaming NDJSON, command logs, correlation headers) and shrinks the CLI surface area.

## What Changes

- **BREAKING**: Remove dedicated HTTP routes under `/api/ffmpeg/*`, `/api/ytdlp/*`, and `/api/videocaptioner/*` from `apps/cli` (download, transcribe, translate, synthesize, process, discover, version, convert, screenshots, tags, extract-data, bilibili helpers, etc.).
- Move command-line argument construction and response interpretation into **shared frontend modules** (`apps/ui/src/lib` or `packages/core`) consumed by React code and `download-service-worker.js`.
- Migrate all callers — including background-job Service Worker handlers — to **`POST /api/executeCmd`** (streaming). Preserve existing user-visible behavior: timeouts, bundled-FFmpeg env for VideoCaptioner, yt-dlp download defaults, format presets, log correlation (`X-Command-Execution-Id`), and job concurrency rules.
- Retain **`apps/cli` internal utils** (`Ffmpeg.ts`, `Ytdlp.ts`, `VideoCaptioner.ts`) only where `executeCmd` path resolution and spawn env still need them; delete route handlers and route tests that become dead code.
- Update **`docs/api/index.md`** and related API docs; keep **`/api/tencent-asr/transcribe`** unchanged (out of scope).
- **BREAKING**: Remove or refactor `apps/ui/src/api/ffmpeg.ts`, `ytdlp.ts`, and `videocaptioner.ts` public fetch wrappers that target removed routes.

## Capabilities

### New Capabilities

- `execute-cmd-client-adapters`: Shared UI/Service Worker adapters that build whitelisted `executeCmd` requests, run streams to completion, parse success/failure, extract download output paths, and surface `executionId` / `logRelativePath` for background jobs.

### Modified Capabilities

- `ytdlp-download-format`: Format selection applies via `executeCmd` `yt-dlp` args instead of `POST /api/ytdlp/download`.
- `download-video-format-listing`: Job payload targets `executeCmd`, not ytdlp download route.
- `download-video-dialog-formats`: Service Worker passes format via client adapter, not download API body.
- `videocaptioner-translate-api`: HTTP translate route removed; behavior specified as client adapter + `executeCmd`.
- `videocaptioner-synthesize-api`: Same for synthesize.
- `videocaptioner-process-api`: Same for process pipeline.
- `videocaptioner-discovery`: Discovery/probing no longer uses `GET /api/videocaptioner/discover` (and analogous ffmpeg/ytdlp discover routes).
- `videocaptioner-integration`: Transcribe trigger and gating reference `executeCmd` instead of `/api/videocaptioner/transcribe`.
- `subtitle-job-command-log-correlation`: Correlation sourced from `executeCmd` response headers instead of videocaptioner JSON bodies.
- `translate-background-job`, `synthesize-background-job`, `process-background-job`: Runners call `executeCmd`.
- `process-ui-feedback`, `synthesize-ui-feedback`: Concurrency wording references `executeCmd` invocations.
- `music-panel-transcribe`, `tv-movie-panel-transcribe`: VideoCaptioner path references `executeCmd` adapter.

## Impact

- **apps/cli**: Delete `src/route/ffmpeg/*`, `src/route/ytdlp/*`, `src/route/videocaptioner/*` route registrations in `server.ts`; keep `executeCmd.ts`, `commandLog.ts`, utils; update/remove route tests.
- **apps/ui**: Refactor API modules, Service Worker, dialogs (`format-converter`, download video), panels (`MusicPanel`, `TvShowEpisodeTable`), hooks (`useVideoCaptionerStatus`, `useYtdlpMutations`), background-job factories; add adapter tests.
- **openspec/specs**: Delta updates for all modified capabilities above; videocaptioner `*-api` specs lose HTTP-route requirements.
- **docs**: `docs/api/index.md`, `ExecuteCmdAPI.md`, design docs referencing old routes.
- **Out of scope**: `POST /api/tencent-asr/transcribe`, MCP tools, e2e unless broken by route removal.
