# ScrapeDialog → useScrapeDialog Hook Refactor

Date: 2026-07-04
Status: Pending implementation

## Problem

`apps/ui/src/components/dialogs/ScrapeDialog.tsx` is a 143-line React component that contains both business logic (mutations, reducer, async task loop, completion check) and a thin render layer over `UIScrapeDialog`. `UIScrapeDialog.tsx` is already a pure presentation component driven entirely by props (`tasks`, `isRunning`, `allTasksDone`, `showButtons`, `cancelDisabled`, `canDismissIncidentally`, `onCancel`, `onStart`).

The current container/presentation wrapper pattern (`ScrapeDialog` wrapping `UIScrapeDialog`) duplicates the React component layer — the wrapper has no rendering of its own, only business logic and prop wiring. The idiomatic React pattern is to put the business logic in a custom hook and let the consumer combine the hook with the presentational component directly.

## Goal

Replace `ScrapeDialog` with `useScrapeDialog`, so that:

1. `UIScrapeDialog` remains the single source of UI.
2. `useScrapeDialog` owns all state, side effects, and side-effect orchestration.
3. The sole consumer (`apps/ui/src/providers/dialog-provider.tsx`) directly composes the hook + `UIScrapeDialog`, with no intermediate wrapper.

This is a behavior-preserving refactor — the dialog must render and behave identically after the change.

## Scope

- New file `apps/ui/src/components/dialogs/useScrapeDialog.ts` containing the hook.
- Delete `apps/ui/src/components/dialogs/ScrapeDialog.tsx`.
- Update `apps/ui/src/providers/dialog-provider.tsx` to use the hook + `UIScrapeDialog`.
- Update `apps/ui/src/components/dialogs/index.ts`:
  - Remove `ScrapeDialog` export.
  - Remove `ScrapeDialogProps` type export.
  - Add `useScrapeDialog` export and `UseScrapeDialogInput` / `UseScrapeDialogResult` type exports.
- Update `apps/ui/src/components/dialogs/types/index.ts`:
  - Remove `ScrapeDialogProps`.
  - Add `UseScrapeDialogInput` / `UseScrapeDialogResult`.
- Rename `ScrapeDialog.test.tsx` → `useScrapeDialog.test.tsx` with a small test harness; reuse existing mocks and assertions.
- `UIScrapeDialog.test.tsx`, `UIScrapeDialogTable.tsx`, `UIScrapeDialog.tsx` unchanged.
- `@/lib/scrapeDialog/*` and `@/lib/scrapeError.ts` unchanged.
- `@/hooks/useScrape*Mutation` unchanged.

## Non-Goals

- Refactoring other dialogs (`ProcessPipelineDialog`, `TranscribeDialog`, `SynthesizeSubtitleDialog`, `SubtitleTranslationDialog`) that still use the same wrapper pattern. Out of scope.
- Changing any user-visible behavior, i18n keys, or test IDs.
- Renaming `ScrapeTaskId` / `ScrapeTaskView` / `ScrapeTaskStatus` (they live in `@/lib/scrapeDialog` and continue to be re-exported from `types/index.ts`).

## Hook API

```ts
// apps/ui/src/components/dialogs/useScrapeDialog.ts

export interface UseScrapeDialogInput {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}

export interface UseScrapeDialogResult {
  tasks: ScrapeTaskView[]
  isRunning: boolean
  allTasksDone: boolean
  showButtons: boolean
  cancelDisabled: boolean
  canDismissIncidentally: boolean
  handleCancel: () => void
  handleStart: () => Promise<void>
}

export function useScrapeDialog(input: UseScrapeDialogInput): UseScrapeDialogResult
```

Field semantics — identical to current `ScrapeDialog.tsx`:

- `tasks` — reducer state for displayed task rows.
- `isRunning` — `state.isRunning`; controls start/cancel disabled and canDismissIncidentally.
- `allTasksDone` — derived from `areAllTasksDone(state.tasks)`.
- `showButtons` — `mediaMetadata !== undefined`.
- `cancelDisabled` — `state.isRunning`.
- `canDismissIncidentally` — `allTasksDone && !state.isRunning`.
- `handleCancel` — current `handleClose`: returns early if `state.isRunning`, otherwise calls `onClose`. Bound to `UIScrapeDialog` `onCancel` and `onOpenChange(false)` paths.
- `handleStart` — current `handleStart`: closes immediately when `allTasksDone`, otherwise runs the task loop and refreshes media metadata on success.

## Consumer Composition (dialog-provider)

The replacement site in `dialog-provider.tsx` replaces the current `<ScrapeDialog …/>` JSX:

```tsx
const scrape = useScrapeDialog({
  isOpen: isScrapeOpen,
  onClose: closeScrape,
  mediaMetadata: scrapeOptions.mediaMetadata,
})

return (
  ...
  <UIScrapeDialog
    isOpen={isScrapeOpen}
    onClose={closeScrape}
    tasks={scrape.tasks}
    isRunning={scrape.isRunning}
    allTasksDone={scrape.allTasksDone}
    showButtons={scrape.showButtons}
    cancelDisabled={scrape.cancelDisabled}
    canDismissIncidentally={scrape.canDismissIncidentally}
    onCancel={scrape.handleCancel}
    onStart={scrape.handleStart}
  />
  ...
)
```

`isOpen` and `onClose` are passed both to the hook (for effect-driven init/completion) and to `UIScrapeDialog` (for the `Dialog open`/`onOpenChange` plumbing). This matches the current behavior: `ScrapeDialog.tsx` reads `isOpen` from its own props, but `UIScrapeDialog` is also passed `isOpen` and `onClose` by the same wrapper.

## Type Plumbing

`types/index.ts` changes:

```ts
export type { ScrapeTaskId, ScrapeTaskStatus, ScrapeTaskView } from "@/lib/scrapeDialog"

export interface UIScrapeDialogProps {
  isOpen: boolean
  onClose: () => void
  tasks: ScrapeTaskView[]
  isRunning: boolean
  allTasksDone: boolean
  showButtons: boolean
  cancelDisabled: boolean
  canDismissIncidentally: boolean
  onCancel: () => void
  onStart: () => void | Promise<void>
}

// ScrapeDialogProps removed.
// Added:
import type { MediaMetadata } from "@core/types"
export interface UseScrapeDialogInput {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}
export interface UseScrapeDialogResult {
  tasks: ScrapeTaskView[]
  isRunning: boolean
  allTasksDone: boolean
  showButtons: boolean
  cancelDisabled: boolean
  canDismissIncidentally: boolean
  handleCancel: () => void
  handleStart: () => Promise<void>
}
```

`index.ts` export changes (dialog barrel):

```ts
// before
export { ScrapeDialog } from "./ScrapeDialog"
export { UIScrapeDialog } from "./UIScrapeDialog"
export type { ScrapeDialogProps, UIScrapeDialogProps, ScrapeTaskView, ScrapeTaskId, ScrapeTaskStatus } from "./types"

// after
export { UIScrapeDialog } from "./UIScrapeDialog"
export { useScrapeDialog } from "./useScrapeDialog"
export type {
  UIScrapeDialogProps,
  UseScrapeDialogInput,
  UseScrapeDialogResult,
  ScrapeTaskView,
  ScrapeTaskId,
  ScrapeTaskStatus,
} from "./types"
```

`ScrapeDialog` and `ScrapeDialogProps` are removed from external API; nothing else in the codebase imports them (verified by grep).

## Test Strategy

`UIScrapeDialog.test.tsx` (`apps/ui/src/components/dialogs/UIScrapeDialog.test.tsx`) keeps its current shape: it renders `<UIScrapeDialog>` with mocked props (no mutations, no reducer). This already validates UI rendering and button wiring in isolation.

`ScrapeDialog.test.tsx` is renamed to `useScrapeDialog.test.tsx`. The behavior it currently validates — initialization, task row visibility for movie folders, server error message capture and localization, cancel-button enablement, running-state disabling — moves into tests that:

1. Import `useScrapeDialog` and `UIScrapeDialog`.
2. Use a small test harness component:

   ```tsx
   function Harness(props: UseScrapeDialogInput) {
     const dlg = useScrapeDialog(props)
     return (
       <UIScrapeDialog
         isOpen={props.isOpen}
         onClose={props.onClose}
         tasks={dlg.tasks}
         isRunning={dlg.isRunning}
         allTasksDone={dlg.allTasksDone}
         showButtons={dlg.showButtons}
         cancelDisabled={dlg.cancelDisabled}
         canDismissIncidentally={dlg.canDismissIncidentally}
         onCancel={dlg.handleCancel}
         onStart={dlg.handleStart}
       />
     )
   }
   ```

3. Render `<Harness isOpen onClose={…} mediaMetadata={…} />` and keep the existing DOM assertions (`scrape-dialog-task-row-poster`, `scrape-dialog-task-status-poster`, `scrape-dialog-cancel`, `scrape-dialog-start`, etc.).

All existing mocks (`@/hooks/useScrapeNfoMutation`, `useScrapePosterMutation`, etc., `@/hooks/userConfig`, `@/hooks/mediaMetadata/useFetchMediaMetadataMutation`, `@/lib/i18n`) move unchanged into the new test file, so coverage of error paths and state transitions is preserved.

## Verification Plan

1. `pnpm -w -C apps/ui lint` — no new lint errors.
2. `pnpm -w -C apps/ui test -- ScrapeDialog` (renamed) and `-- UIScrapeDialog` — both green.
3. Manual smoke: open the scrape dialog from a recognized media row; confirm task table, start button, cancel behavior, and error localization still render.
4. `git grep -n 'ScrapeDialog' apps/ui` returns only expected hits (test file names, history) and nothing in production code.
