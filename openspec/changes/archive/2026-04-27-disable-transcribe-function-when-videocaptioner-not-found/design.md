## Context

The CLI now exposes VideoCaptioner availability through `videocaptioner` discovery, but the UI still treats Transcribe as always actionable. This creates a mismatch where users can invoke a feature that is guaranteed to fail when the executable is missing. The change spans two UI touchpoints: action availability in `MusicFileTable` and system feedback in `StatusBar`.

## Goals / Non-Goals

**Goals:**
- Gate the `Transcribe` context-menu action using the same VideoCaptioner availability state already used by discovery-related UI.
- Surface a clear, typed status bar message when VideoCaptioner is unavailable.
- Keep behavior reactive so UI updates without restart when availability changes.

**Non-Goals:**
- Reworking VideoCaptioner executable discovery logic in CLI.
- Changing backend transcribe API semantics or error shape.
- Adding new settings pages or installation workflows.

## Decisions

1. Reuse existing discovery state as the single source of truth.
   - Rationale: avoids duplicated probing logic in UI and keeps decision-making aligned with CLI behavior.
   - Alternative considered: independently check executable paths in UI; rejected due to platform complexity and drift risk.

2. Disable (not hide) the `Transcribe` action in `MusicFileTable`.
   - Rationale: preserving menu visibility improves discoverability and communicates feature availability constraints.
   - Alternative considered: conditionally hide the action; rejected because users lose context on why transcription is unavailable.

3. Emit a status bar `error` message via existing `MessageIndicator` pipeline when discovery is unavailable.
   - Rationale: status bar is already used for service availability messaging; this keeps diagnostics centralized and consistent.
   - Alternative considered: toast-only warning; rejected because toasts are transient and easy to miss for persistent configuration issues.

4. Keep message content focused on state, not remediation workflow.
   - Rationale: this change targets gating and visibility; installation guidance can be added later without blocking current UX fix.
   - Alternative considered: include multi-step install instructions in status message; rejected as too verbose for status bar surface.

## Risks / Trade-offs

- [Risk] Disabled-state visuals may be unclear in some table/theme combinations.  
  → Mitigation: rely on existing disabled menu item styling and verify in current UI theme.

- [Risk] If discovery state is stale, action gating may lag behind real executable changes.  
  → Mitigation: use existing refresh/reactive discovery mechanism without introducing new cache layers.

- [Risk] Additional status message could increase message noise.  
  → Mitigation: only show message when unavailable and rely on typed severity filtering already used by `MessageIndicator`.

## Migration Plan

No data migration is required. Rollout is code-only:
1. Add availability-driven disabled behavior to `MusicFileTable` transcribe menu item.
2. Add VideoCaptioner unavailable message construction in `StatusBar`.
3. Verify with manual UI checks for both available/unavailable discovery states.
4. Rollback strategy: revert this change set to restore previous always-enabled behavior.

## Open Questions

- Should the status message include a direct link to settings/help for executable configuration in this change or a follow-up change?
