## Context

The music panel currently focuses on single-row interaction and does not expose an explicit selection mode for multi-row operations. The requested change spans `MusicHeaderV2`, `MusicFileTable`, and `MusicPanel`, so mode state must be coordinated across parent/child boundaries to keep behavior deterministic.

Current constraints:
- Keep UI behavior intuitive: default non-selection mode, explicit enter/exit via header button.
- Preserve existing table behaviors when not in selection mode.
- Additions should remain local to music panel components without changing backend contracts.

## Goals / Non-Goals

**Goals:**
- Add a clear `Select` button in `MusicHeaderV2` and switch to `Cancel` while selection mode is active.
- Introduce multi-selection mode in `MusicFileTable` controlled by parent state.
- Render a leading checkbox column only in multi-selection mode.
- Exit multi-selection mode cleanly on `Cancel` and reset temporary row selections.
- Keep state flow testable and deterministic through `MusicPanel`.

**Non-Goals:**
- Implementing batch action execution (delete/export/transcode) in this change.
- Changing file data-fetching behavior or table pagination/sorting model.
- Persisting multi-selection mode or selected rows across navigation/reload.

## Decisions

1. Use `MusicPanel` as single source of truth for selection mode.
   - Decision: Store `isMultiSelectMode` in `MusicPanel` and pass props/callbacks to `MusicHeaderV2` and `MusicFileTable`.
   - Rationale: Avoids duplicated local state and keeps toggle behavior synchronized.
   - Alternative: Let header own mode state and notify table indirectly; rejected due to tighter coupling and harder testing.

2. Conditional first column for checkboxes in table.
   - Decision: `MusicFileTable` prepends a checkbox column only when `isMultiSelectMode` is true.
   - Rationale: Keeps default view unchanged and makes mode transition visually obvious.
   - Alternative: Always show checkboxes and disable outside mode; rejected because of persistent visual noise.

3. Reset row selections on mode exit.
   - Decision: Clicking `Cancel` sets `isMultiSelectMode` false and clears selected row ids.
   - Rationale: Prevents stale accidental selections when mode is re-entered later.
   - Alternative: Retain previous selections; rejected because user intent on re-enter is ambiguous.

4. Keep button labeling mode-driven and explicit.
   - Decision: Header button text and handler switch between `Select` (enter mode) and `Cancel` (exit mode).
   - Rationale: Clear state transition with minimal interaction cost.
   - Alternative: Separate two buttons; rejected due to clutter and redundant controls.

## Risks / Trade-offs

- [Risk] Checkbox column insertion may affect existing column sizing/alignment
  -> Mitigation: Use fixed narrow width and verify table layout tests/snapshots.

- [Risk] Selection state may drift if row keys are unstable
  -> Mitigation: Use stable file identifier keys for selected-row tracking.

- [Risk] Mode toggle interactions may regress keyboard/accessibility flow
  -> Mitigation: Ensure button and checkboxes have proper labels and focus behavior in tests.

- [Trade-off] Clearing selection on cancel sacrifices convenience for safety
  -> Benefit: Reduces accidental bulk actions from stale selections.

## Migration Plan

1. Add mode state and toggle handlers in `MusicPanel`.
2. Update `MusicHeaderV2` to render mode-aware `Select/Cancel` action.
3. Update `MusicFileTable` to support:
   - optional multi-select mode prop
   - conditional leading checkbox column
   - selected-row tracking callbacks
4. Add/update tests for:
   - entering selection mode from `Select`
   - showing checkbox column only in mode
   - exiting via `Cancel` and clearing selection
5. Validate manually in music panel flow and run relevant UI tests.

Rollback strategy:
- Revert `MusicHeaderV2` button and `MusicFileTable` checkbox-mode changes while preserving unrelated table updates.

## Open Questions

- Should selected-row count be surfaced in header while in multi-select mode (e.g., “3 selected”) in this change or a follow-up?
- Do we need shift-click range selection now, or keep single-click multi-select only for this iteration?
