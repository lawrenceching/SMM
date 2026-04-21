## Why

VideoCaptioner discovery currently depends on limited executable lookup locations, which misses common Python `Scripts` installs (especially pip-installed paths on Windows). The app also does not surface the resolved VideoCaptioner path in settings, making troubleshooting and verification harder for users.

## What Changes

- Extend VideoCaptioner executable discovery to include Python installation `Scripts` folders (pip-installed location patterns), including Windows paths such as `/c/Users/<user>/AppData/Local/Programs/Python/Python310/Scripts/videocaptioner.exe`.
- Keep discovery behavior presence-based and startup-compatible so UI feature gating remains deterministic.
- Add a new display item in `apps/ui/src/components/ui/settings/GeneralSettings.tsx` to show the discovered VideoCaptioner path.
- Preserve existing transcribe behavior and API contracts while improving discovery reliability and observability.

## Capabilities

### New Capabilities
- `videocaptioner-discovery`: Discover pip-installed VideoCaptioner executables from Python `Scripts` folders and surface discovered path in settings UI.

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/cli/src/utils/VideoCaptioner.ts` discovery logic; potentially related discover route; `apps/ui/src/components/ui/settings/GeneralSettings.tsx` and related API/UI wiring.
- APIs: Discovery response remains path/error based; may return additional valid paths from Python folders.
- Dependencies/systems: Python runtime installation layout and pip-installed executable locations across OSes.
