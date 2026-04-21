## Why

Users currently cannot run automatic transcription from within the desktop app, forcing a manual external workflow for subtitle generation. Integrating VideoCaptioner now enables a native transcription entry point and makes capability availability explicit at startup.

## What Changes

- Add a new VideoCaptioner transcription capability exposed through a `Transcribe` context menu action in `MusicPanel` for supported media files.
- Add backend API support to invoke the VideoCaptioner CLI transcription command asynchronously from the app.
- Add startup-time VideoCaptioner discovery (executable presence check only) so the UI can enable or disable transcription actions based on runtime availability.
- Add user-facing feedback for command submission success and command errors.
- Use fixed transcription defaults in v1 without user-configurable options.

## Capabilities

### New Capabilities
- `videocaptioner-integration`: Integrate VideoCaptioner discovery and transcription execution into UI and API flows.

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/ui` context menus, action handlers, and API client calls; `apps/cli` route/tooling for command execution and discovery.
- APIs: New transcription endpoint and a discovery/health result used by UI feature gating.
- Dependencies/systems: VideoCaptioner CLI executable availability in runtime environment; existing command execution pipeline.
