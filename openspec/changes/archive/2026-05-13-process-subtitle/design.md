## Context

SMM already integrates VideoCaptioner for **`transcribe`**, **`subtitle`** (translate/optimize path), and **`synthesize`**, each with a dedicated CLI helper, Hono route, zod validation, IndexedDB job type, service worker driver, and panel UX. The upstream **`process`** subcommand runs **transcribe → split → optimize → translate → synthesize** (with `--no-synthesize` and audio skipping synthesis per [CLI docs](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md)). This design extends those patterns instead of inventing a parallel orchestration layer in Node.

## Goals / Non-Goals

**Goals:**

- Invoke **`videocaptioner process <mediaPath>`** from the CLI service with validated flags, shared discovery/env/timeout/stderr behavior consistent with `Synthesize.ts` / existing transcribe routes.
- Let users start **one or more** pipeline jobs from **TvShow**, **Movie**, and **Music** surfaces with the same menu/dialog/job feedback conventions as existing captioning features.
- Persist jobs as **`type: 'process'`** and run them sequentially per batch in the download service worker, mirroring `translate` / `synthesize`.
- Document **`POST /api/videocaptioner/process`** (or the chosen path) in `docs/api/index.md`.

**Non-Goals:**

- Implementing **`videocaptioner download`**, **`style`**, or **`config`** subcommands in the app.
- A custom multi-step orchestration in TypeScript that replaces `process` (the CLI remains the single source of pipeline semantics).
- Changing Tencent ASR architecture beyond what is needed to gate **Process** consistently with the transcribe leg (same rules as today’s transcribe entry points).

## Decisions

1. **Single CLI entrypoint** — Call **`videocaptioner process`** only (not chained `transcribe` + `subtitle` + `synthesize` from the server). **Rationale:** Matches upstream behavior, one stderr stream, one exit code, one timeout boundary. **Alternative considered:** Chain existing helpers — rejected due to duplicated state and divergent error handling.

2. **HTTP shape** — Add **`POST /api/videocaptioner/process`** with a zod schema that includes:
   - **`mediaPath`** (required, non-empty platform path; file must exist).
   - **Transcribe leg:** reuse the same ASR / language / wordTimestamps / format literals already used by the transcribe API where they map 1:1 to CLI flags.
   - **Subtitle leg:** `translator`, `targetLanguage`, booleans for `noOptimize`, `noTranslate`, `noSplit`, optional `reflect`, `layout`, optional `prompt` — only fields the product exposes in v1; omit unsupported flags from the request rather than passing empty strings.
   - **Synthesize leg:** optional block (`subtitleMode`, `quality`, `style`, `renderMode`, `layout`) plus **`noSynthesize: boolean`** mirroring `--no-synthesize`.
   - **Rationale:** One request models one CLI invocation. **Alternative:** Split into multiple HTTP calls — rejected; breaks atomic “process” semantics.

3. **Timeout** — Introduce **`PROCESS_TIMEOUT_MS`** (new constant) **≥** `TRANSCRIBE_TIMEOUT_MS + SYNTHESIZE_TIMEOUT_MS` (or a single generous ceiling such as 2h) because `process` can span transcribe + mux. **Rationale:** Avoid killing legitimate long runs. **Trade-off:** Stuck processes take longer to surface; mitigation: stop button + same kill-on-stop as other jobs.

4. **UI entry** — Add **Process** (or localized “Full pipeline”) as a **fifth child** under the existing **Subtitle** parent in headers and **`MusicFileTable`** row submenu, after **Synthesize**, with the same multi-select / clear-selection / toast-on-empty patterns. **Rationale:** Keeps one mental model (“subtitle-related VideoCaptioner actions”). **Alternative:** Top-level toolbar button — rejected to avoid duplicating gating logic.

5. **Gating** — **Process** requires **VideoCaptioner available** (same as Translate/Synthesize). For the **transcribe** portion, apply the **same ASR / Tencent rules** as **Transcribe**: if the chosen ASR needs Tencent and Tencent is off, disable confirm or the menu item with a clear reason. **Rationale:** Avoid requests the CLI cannot satisfy. **Alternative:** Always enable and fail at runtime — worse UX.

6. **Job payload** — Store **`mediaPath`** (platform + POSIX), folder id, display title, flattened options object, and timestamps; reuse **`build*Job` / `save*Job`** patterns from `synthesize` / `translate`. Service worker posts JSON body built from stored fields.

7. **Naming** — Background job **`type: 'process'`**, SW events **`process:start|stop|remove`**, hook **`useProcessManager`**, dialog **`ProcessPipelineDialog`** / **`UIProcessPipelineDialog`** (exact names follow existing `Synthesize*` naming).

## Risks / Trade-offs

- **[Risk] Very long runs and large disk use** → Mitigation: conservative timeout, clear UI copy that pipeline includes synthesis unless `--no-synthesize`; optional default **`noSynthesize: true`** in dialog is an **open product choice** (see below), not locked in design.

- **[Risk] CLI version skew** (flags differ across VideoCaptioner versions) → Mitigation: document minimum CLI version in proposal/implementation notes; integration tests focus on argv construction from known option sets.

- **[Risk] Partial failure** (e.g. transcribe OK, synthesize fails) → Mitigation: surface full stderr excerpt (existing 500-char pattern); user retries with **`noSynthesize`** if appropriate.

- **[Risk] Whisper API / LLM options** without keys → Mitigation: zod rejects missing required fields; dialog does not offer combinations that require keys unless settings provide them (align with transcribe/subtitle dialogs).

## Migration Plan

- No database migration: new job type and API are additive.
- **Rollback:** hide menu items behind no-op or remove route registration; old clients ignore unknown job types (ensure `useJobManager` tolerates unknown types or filters `process` safely if rolled back).

## Open Questions

1. **Default for synthesis:** Should the dialog default **`noSynthesize`** to **true** (safer, subtitle-only output) or **false** (full upstream default)? Product decision during `process-pipeline-dialog` spec / implementation.

2. **v1 option surface:** Whether to expose **LLM-only** flags (`--api-key` passthrough vs env-only) in the first release; design leans **env/config only** for secrets unless the app already stores LLM keys for other features.

3. **`music-panel-process-status`:** Confirm during specs whether row-level **Stop process** + spinner mirror **synthesize** exactly; proposal lists this as conditional—resolve in delta spec.
