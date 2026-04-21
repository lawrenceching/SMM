## Context

SMM currently supports media operations such as download and metadata workflows, but does not provide built-in speech-to-text transcription. The requested integration introduces VideoCaptioner CLI as an external runtime dependency and spans both backend (`apps/cli`) and frontend (`apps/ui`) modules.

The UI must expose transcription only when the CLI is discoverable, and transcription requests should be non-blocking so users can continue other operations. This needs a simple availability contract between startup discovery and context-menu rendering.

## Goals / Non-Goals

**Goals:**
- Provide a `Transcribe` action in `MusicPanel` media-file context menus for v1.
- Add backend command execution endpoint(s) to discover and invoke VideoCaptioner.
- Gate UI action availability from discovery status at startup.
- Return immediate API responses with clear success/error notifications in UI.

**Non-Goals:**
- Building an in-app transcription progress viewer.
- Bundling VideoCaptioner binaries into SMM release artifacts.
- Post-processing subtitles (format conversion, timing correction, translation).

## Decisions

- **Decision: Reuse existing command execution infrastructure for VideoCaptioner invocation.**  
  Rationale: The app already executes external tooling (for example ffmpeg/yt-dlp); reusing this pattern minimizes new operational risk and keeps logs/error handling consistent.  
  Alternative considered: adding a dedicated long-running job worker for transcription. Rejected for initial scope because the request only requires command submission and immediate acknowledgment.

- **Decision: Add an explicit discovery API during startup and cache capability in UI state.**  
  Rationale: Startup discovery avoids repeated path probing on every menu open and gives deterministic enable/disable behavior for `Transcribe`.  
  Alternative considered: lazy discovery at click time. Rejected because it creates delayed UX and confusing first-click failures.

- **Decision: Discovery checks executable presence only.**  
  Rationale: Presence checks are fast, deterministic, and sufficient for v1 feature gating requirements.  
  Alternative considered: running lightweight `--help`/version validation. Rejected for v1 to avoid startup overhead and command-specific parsing complexity.

- **Decision: Keep transcription API asynchronous (fire-and-return semantics).**  
  Rationale: Transcription runtime can be long; synchronous requests would degrade responsiveness and increase timeout risk.  
  Alternative considered: blocking API returning final result. Rejected due to poor UX and timeout constraints.

- **Decision: Scope integration to command availability + trigger only.**  
  Rationale: This aligns with the proposal and keeps the first increment small and testable.  
  Alternative considered: full lifecycle management (progress, cancel, retries). Deferred to a future change.

- **Decision: Use fixed transcription defaults in v1 (no user-configurable options).**  
  Rationale: Fixed defaults reduce UI/API surface area and speed up initial delivery while satisfying core transcription needs.  
  Alternative considered: exposing configurable options in UI and API. Deferred to a follow-up change after baseline adoption.

## Risks / Trade-offs

- **[Runtime dependency variability]** Different machines may not have VideoCaptioner installed or in PATH -> **Mitigation:** robust discovery checks at startup and clear disabled-state messaging.
- **[Command execution failure]** CLI may fail due to unsupported media or environment issues -> **Mitigation:** surface backend stderr summary and actionable toast messages.
- **[UI/backend contract drift]** Discovery payload shape could change and silently break menu gating -> **Mitigation:** typed response contracts with unit tests in UI API layer.
- **[Long-running process observability gap]** Fire-and-return provides no in-app progress -> **Mitigation:** document current behavior and plan follow-up enhancement for job status.

## Migration Plan

1. Add backend discovery and transcription routes plus command invocation helpers.
2. Add frontend API wrappers and startup discovery call.
3. Wire context-menu `Transcribe` action to enabled state and API trigger.
4. Add/adjust tests for discovery gating and command trigger behavior.
5. Rollout with feature enabled by default when CLI is discoverable.

Rollback: remove/hide `Transcribe` UI action and disable API routes; existing media workflows remain unaffected.

## Resolved Scope Decisions

- Discovery checks executable presence only.
- `Transcribe` is exposed in `MusicPanel` only for v1.
- v1 uses fixed transcription defaults (no configurable options).
