## Why

Users currently cannot quickly select multiple music rows for batch-oriented workflows in the music panel. Adding an explicit select/cancel mode improves usability by making multi-selection state visible and reversible.

## What Changes

- Add a `Select` / `Cancel` mode toggle action in `MusicHeaderV2`.
- Enable multi-selection mode in `MusicFileTable` when `Select` is clicked.
- In multi-selection mode, render a checkbox column at the first position of the table.
- Exit multi-selection mode and hide checkbox column when `Cancel` is clicked.
- Wire the selection mode state through `MusicPanel` to coordinate header action and table behavior.

## Capabilities

### New Capabilities
- `music-panel-multi-select-mode`: Introduce explicit multi-select mode UX in music panel with header toggle and table checkbox-column behavior.

### Modified Capabilities
- `transcribe-ui-feedback`: Extend panel interaction requirements to support explicit selection mode toggling and multi-row selection affordances in music file table.

## Impact

- Affected UI components: `apps/ui/src/components/MusicHeaderV2.tsx`, `apps/ui/src/components/MusicFileTable.tsx`, `apps/ui/src/components/MusicPanel.tsx`.
- Affected tests: component tests around music header actions and music file table rendering/state transitions.
- No backend/API changes; scope is frontend interaction and presentation logic.
