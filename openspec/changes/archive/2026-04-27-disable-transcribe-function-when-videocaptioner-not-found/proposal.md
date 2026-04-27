## Why

The UI currently allows users to trigger Transcribe even when VideoCaptioner is unavailable, causing avoidable failures and unclear diagnostics. Since executable discovery is now implemented in CLI, the UI should react to that availability state and guide users before they run transcription actions.

## What Changes

- Disable the `Transcribe` context-menu action in `MusicFileTable` when VideoCaptioner discovery reports unavailable.
- Add a status bar message entry indicating VideoCaptioner is not found, using existing typed message behavior.
- Ensure the disabled action and status bar signal update when discovery state changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `videocaptioner-discovery`: Extend discovery consumption behavior so UI surfaces unavailable state as actionable feedback.
- `statusbar-message-indicator`: Add VideoCaptioner-not-found message requirement in status bar typed messages.
- `transcribe-ui-feedback`: Require Transcribe action gating in `MusicFileTable` when dependency is unavailable.

## Impact

- Affected UI files: `apps/ui/src/components/StatusBar.tsx`, `apps/ui/src/components/MusicFileTable.tsx`.
- Affected integration point: existing VideoCaptioner discovery response contract from `apps/cli/src/route/videocaptioner/Discover.ts`.
- User impact: fewer failed transcription attempts and clearer remediation signal in status bar.
