## Why

When VideoCaptioner is unavailable, users currently only see a plain error in the status bar and may not know how to install or enable it. Adding a direct help link reduces friction and gives users an immediate recovery path.

## What Changes

- Update the VideoCaptioner "not found" status bar message to include a documentation link to the VideoCaptioner CLI section.
- Ensure the message remains an error-type status indicator while adding actionable help navigation.
- Keep existing status bar message rendering behavior unchanged for all other messages.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `statusbar-message-indicator`: Require the VideoCaptioner not-found message to provide a link to `https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C`.

## Impact

- Affected spec: `openspec/specs/statusbar-message-indicator/spec.md` (delta spec required).
- Expected code touch points: UI status bar message creation for VideoCaptioner discovery failure, plus related UI assertions/tests if present.
- No API, protocol, or dependency changes.
