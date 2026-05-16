## Context

`POST /api/executeCmd` already whitelists `ffmpeg`, `ffprobe`, `yt-dlp`, and `videocaptioner`, streams NDJSON stdout/stderr, writes command execution logs, returns `X-Command-Execution-Id` / `X-Command-Log-Path`, and serializes concurrent `yt-dlp` runs. Dedicated routes wrap the same binaries via `runWhitelistedCommandSync` or bespoke spawn code with Zod-validated JSON bodies. The UI is split: `apps/ui/src/api/ytdlp.ts` uses `executeCmdStream` for `-J` probes but `fetch('/api/ytdlp/download')` for downloads; `download-service-worker.js` calls videocaptioner JSON routes; `apps/ui/src/api/ffmpeg.ts` and `videocaptioner.ts` only use legacy routes.

Tencent ASR remains a separate HTTP API and is unchanged.

## Goals / Non-Goals

**Goals:**

- Single client execution path: build `args[]`, call `executeCmdStream` (or a thin sync wrapper that drains the stream), interpret exit/system messages.
- Preserve end-user behavior: download folder/args/format presets, VideoCaptioner CLI flags, bundled FFmpeg PATH for VideoCaptioner, job batching/concurrency, command-log dialog correlation.
- Delete redundant CLI routes and tests; update OpenSpec deltas and API docs.

**Non-Goals:**

- Changing the executeCmd whitelist, arg validation limits, or adding new whitelisted binaries.
- Rewriting Tencent ASR, media metadata, or TMDB/TVDB routes.
- Moving binary discovery to the renderer without CLI involvement (discovery stays server-side inside `executeCmd` resolution; clients probe via executeCmd failure modes or lightweight version invocations).

## Decisions

### 1. Shared arg builders in `packages/core` or `apps/ui/src/lib`

**Decision:** Add `apps/ui/src/lib/whitelistedCmd/` (or `packages/core/whitelistedCmd/` if Service Worker bundling requires it) with pure functions:

- `buildYtdlpDownloadArgs({ url, folder, args, format })`
- `buildVideoCaptionerTranscribeArgs(body)` / translate / synthesize / process
- `buildFfmpegConvertArgs`, `buildFfprobeTagsArgs`, etc.

Port logic from `apps/cli/src/route/*` and `apps/cli/src/utils/VideoCaptioner.ts` **flag mapping** (not spawn). CLI utils remain for `resolveCommandPath` and `resolveSpawnEnvForVideoCaptioner` used only inside `executeCmd`.

**Alternatives considered:** Keep builders only in CLI and pass opaque job payloads — rejected because removed routes eliminate server-side validation/body-to-args translation.

### 2. Service Worker uses streaming executeCmd, not sync JSON

**Decision:** SW handlers POST `/api/executeCmd`, read NDJSON until `system.exit|error|timeout`, map to job success/failure. Reuse the same arg builders as the main thread (shared module copied into SW bundle or imported if Vite/SW build allows).

**Rationale:** Matches executeCmd contract; avoids reintroducing `runWhitelistedCommandSync` HTTP wrappers.

### 3. Discovery and version checks via executeCmd probe

**Decision:** Replace `GET /api/*/discover` and `GET /api/*/version` with client helpers that call `executeCmd` with safe read-only args (e.g. `yt-dlp --version`, `ffmpeg -version`) and treat HTTP 400 `"executable not found"` or non-zero exit as unavailable. Settings UI continues to show resolved behavior via user config path when set.

**Alternatives:** New `GET /api/tools/status` aggregate endpoint — rejected to keep one execution API.

### 4. Download path and JSON-shaped outcomes parsed client-side

**Decision:** yt-dlp download success detection parses stdout (existing patterns in `Download.ts` / worker) after stream completion; errors use stderr excerpt + exit code. No `{ success, path, error }` JSON from CLI.

### 5. Log correlation for subtitle jobs

**Decision:** SW reads `X-Command-Execution-Id` and `X-Command-Log-Path` from the executeCmd response (already supported in `executeCmd.ts` client) instead of videocaptioner JSON fields. Update `subtitle-job-command-log-correlation` spec accordingly.

### 6. FFmpeg tag read/write and screenshots

**Decision:** ffprobe/ffmpeg invocations via `executeCmd` with args built in client adapters; parse stdout JSON/text in UI layer (reuse parsing from former route handlers moved to shared lib).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| SW bundle size grows with shared arg builders | Keep builders small; avoid pulling Node-only code into SW |
| Loss of server-side Zod validation | Duplicate critical validation in `packages/core` validators already used by UI where possible; executeCmd arg length/char rules remain server-enforced |
| Long-running jobs depend on stream keep-alive | Reuse existing server timeout for executeCmd; SW passes `X-Timeout` consistent with prior route timeouts |
| Breaking external consumers of removed routes | Document **BREAKING** in changelog; SMM is desktop monorepo with no public third-party API guarantee |
| Regressions in allow-listed yt-dlp `args` | Centralize allow-list in shared module used by download adapter |

## Migration Plan

1. Introduce client adapters + tests (no route deletion).
2. Switch React API modules and SW to adapters behind feature parity tests.
3. Remove CLI route handlers and `server.ts` registrations.
4. Delete dead UI fetch wrappers; update docs and OpenSpec archive.
5. Run `pnpm test:cli`, `pnpm test:ui`, targeted e2e for download/transcribe flows.

Rollback: revert commit series; routes restored from git.

## Open Questions

- Whether `packages/core` vs `apps/ui/src/lib` is better for SW-importable builders (decide during implementation based on bundler constraints).
- Whether `runWhitelistedCommandSync` stays exported for MCP/internal CLI use after route removal (likely yes, not HTTP-exposed).
