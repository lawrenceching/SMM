## Context

SMM already writes every whitelisted CLI invocation (including `videocaptioner` via `runWhitelistedCommandSync`) to `<LOG_DIR>/commands/<executionId>/main.log`. The streaming `POST /api/executeCmd` path exposes `executionId` via response headers, but subtitle pipelines use JSON `POST /api/videocaptioner/*` from the service worker and never persist correlation IDs. The Status Bar **Background jobs** popover (`BackgroundJobsPopover`) lists jobs from `backgroundJobsStore` (fed by `IndexedDbObserver`) but offers no drill-down into command output. A product-level design already exists at `docs/design/log-dialog-design.md`; this change-level design condenses executable decisions for implementers.

## Goals / Non-Goals

**Goals:**

- Correlate each subtitle background job (`transcribe`, `translate`, `synthesize`, `process`) with the CLI `executionId` and optional `logRelativePath` once the service worker receives the API response.
- Provide a read-only, same-origin HTTP API to fetch log file contents (or structured segments) safely by `executionId`.
- Let users open a **LogDialog** from the background-jobs list when `executionId` is present, with loading, error, truncation, refresh, and copy affordances aligned with `ExecuteCmdDialog` ergonomics.
- Register the dialog through `DialogProvider` / `useDialogs` for consistency with other global dialogs.

**Non-Goals:**

- Altering the NDJSON contract or headers of `POST /api/executeCmd`.
- Adding log buttons for `download-video` (yt-dlp) jobs in this change.
- Log search, aggregation, or remote shipping; log retention / rotation policy.
- Rewriting `ExecuteCmdDialog` beyond optional shared styling tokens.

## Decisions

1. **Return shape for `runWhitelistedCommandSync`**  
   Extend the existing result type with optional `executionId` and `logRelativePath` populated from `createCommandExecutionLogWriter` (already created per invocation). **Rationale:** minimal churn for callers; failure paths still carry IDs when the writer was created. **Alternative considered:** parallel channel (new header-only internal API) — rejected as redundant.

2. **Videocaptioner routes always echo correlation fields**  
   Success and error JSON bodies include `executionId` / `logRelativePath` whenever the writer exists. **Rationale:** failed runs are the primary debugging need. **Alternative:** headers only — rejected because SW `parseApiResponseBody` already consumes JSON bodies.

3. **New `GET /api/command-log/:executionId`**  
   UUID-only path param; resolve with `path.resolve(getLogDir(), 'commands', id, 'main.log')` and assert resolved path stays under the commands root. Support `format=raw|segments` and byte `offset`/`limit` with a hard cap and `X-Log-Truncated` (and optional `Content-Length`). **Rationale:** keeps browser reads simple and auditable. **Alternative:** WebSocket tail — rejected as over-engineered for desktop.

4. **Service worker persistence timing**  
   After `parseApiResponseBody`, merge `executionId` / `logRelativePath` from the body into `job.data` and `dbPutJob` before transitioning to terminal status so IndexedDB always carries correlation if the server returned it. **Rationale:** `IndexedDbObserver` already rebuilds store entries from IDB snapshots.

5. **UI data loading**  
   TanStack Query keyed by `['command-log', executionId, format, offset]` with long `staleTime` for terminal job statuses and slow polling while job status is non-terminal if live tail is desired (optional: poll only when dialog open and status `running`). **Rationale:** matches app-wide data-fetch patterns.

6. **LogDialog placement**  
   New `logDialog` tuple on `DialogContext` mirroring `executeCmdDialog`. **Rationale:** avoids prop drilling from StatusBar into popover. **Alternative:** zustand-only modal — rejected to stay consistent with `DialogProvider`.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Log files may contain secrets (API keys in stderr) | Keep access local-only; document in UI copy; do not add “share log” in v1. |
| Very large logs lock UI | Server truncation + client virtualized list + “download more” follow-up. |
| Old SW caches miss new fields | Document need for SW refresh after deploy; version bump if project uses SW update flow. |
| Race: log not flushed before first GET | Return 404 with retry hint; client backoff. |

## Migration Plan

1. Ship CLI + UI together in one release (UI depends on new JSON fields and log route).
2. Existing IndexedDB jobs without `executionId` simply hide the log button — no DB migration required.
3. Rollback: remove route + UI entry points; SW ignores unknown JSON fields safely.

## Open Questions

- Exact maximum log bytes per HTTP response (proposal suggests ~2 MiB; confirm with ops / largest observed `videocaptioner` logs).
- Whether v1 needs live tail for `running` jobs or static fetch-after-completion is enough (design doc suggests optional polling).

## References

- `docs/design/log-dialog-design.md`
- `openspec/changes/log-dialog/proposal.md`
