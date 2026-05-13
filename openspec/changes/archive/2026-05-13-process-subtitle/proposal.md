## Why

SMM already wires VideoCaptioner for **transcribe**, **subtitle (translate/optimize)**, and **synthesize** as separate steps. Users who want the upstream **full pipeline** (transcribe → split → optimize → translate → optional synthesize) in one run must run `videocaptioner process` outside the app. Integrating **`process`** aligns the product with [VideoCaptioner CLI](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md) and reduces manual chaining while reusing discovery, timeouts, and background-job patterns already used elsewhere.

## What Changes

- Add a **CLI + HTTP** path that invokes `videocaptioner process <media>` with validated options (including transcribe/subtitle/synthesize-related flags, `--no-synthesize`, and other documented `process` options), with the same discovery, environment (e.g. bundled FFmpeg), timeout, and stderr handling as existing VideoCaptioner integrations.
- Expose a **UI entry point** (panel headers and music row flows consistent with existing **Subtitle** / transcribe patterns) to start a **full pipeline** job for eligible media, including an options dialog for the main flags users care about (ASR, translator, target language, toggles such as no-optimize / no-translate / no-split / no-synthesize, etc., scoped by what the app chooses to support in v1).
- Persist and run **`process`** work as **background jobs** (IndexedDB + service worker + manager hook), with **start/success/failure** feedback analogous to transcribe/translate/synthesize, including sequential execution rules if multiple jobs are queued.
- Document the new HTTP endpoint in the API index.

## Capabilities

### New Capabilities

- `videocaptioner-process-api`: HTTP API and CLI wrapper for `videocaptioner process` (input validation, stderr excerpt on failure, executable missing, timeout, parity with existing VideoCaptioner route patterns).
- `process-pipeline-dialog`: Smart dialog for choosing media targets and `process` options (defaults, persistence where appropriate, confirm/cancel, eligibility rules per panel).
- `process-background-job`: IndexedDB job type, service worker lifecycle (`process:start|stop|remove`), React manager hook and observer wiring consistent with existing job types.
- `process-ui-feedback`: Toasts and in-app messaging for pipeline start/complete/fail; gating when VideoCaptioner is unavailable or targets are ineligible.
- `music-panel-process-status` (if required by the same row/header patterns as other jobs): Row-level status indicators and submenu items for **Process** / **Stop process** on `MusicFileTable`, aligned with existing transcribe/synthesize UX.

### Modified Capabilities

- `panel-subtitle-menu`: Add a **Process** (full pipeline) action alongside **Transcribe**, **Translate**, and **Synthesize** where product intent places it (same menus or clarified grouping), including per-child gating, multi-select defaults, and toasts when nothing is eligible.
- `videocaptioner-integration`: Extend discovery/gating requirements so **Process** is enabled only when the pipeline can run (VideoCaptioner available; clarify relationship to Tencent ASR for the transcribe leg per CLI rules).

## Impact

- **apps/cli**: `VideoCaptioner` helper argv for `process`, new Hono route module, server registration, tests, `docs/api/index.md`.
- **apps/ui**: New dialog components, panel/header/`MusicFileTable` wiring, `download-service-worker.js`, `downloadTaskDb`, background job types, `IndexedDbObserver` / `useJobManager`, i18n keys (en + zh locales).
- **Dependencies**: Same runtime dependency on a discoverable `videocaptioner` executable and optional bundled FFmpeg; optional LLM/API keys only if the dialog exposes LLM-backed subtitle options in scope.
- **Specs**: Five new delta specs under `openspec/changes/process-subtitle/specs/<capability>/spec.md` plus two modified-capability deltas; later sync to `openspec/specs/` after implementation.
