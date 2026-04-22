## Why

The current status bar only surfaces TMDB and TVDB availability as connection states, which makes warning and error information less actionable and harder to scale. A unified message indicator is needed now to show service health issues in a consistent, user-noticeable way with severity and help links.

## What Changes

- Replace the existing `ConnectionStatusIndicator` behavior in `StatusBar` with a `MessageIndicator` model that consumes typed messages (`title`, optional `link`, `type`).
- Convert existing TMDB and TVDB availability outputs into two messages owned by `MessageIndicator`, both marked as `error` when unavailable.
- Add badge behavior on the `StatusBar` message icon to display the count of `warning` and `error` messages as a red notification dot/count indicator.
- Keep informational messages (`info`) visible in message content but excluded from warning/error badge count.

## Capabilities

### New Capabilities
- `statusbar-message-indicator`: Display typed status messages in the status bar and highlight actionable warning/error states through a badge count.

### Modified Capabilities
- `videocaptioner-discovery`: Update UI-facing service availability feedback requirements to use message-based severity output (TMDB/TVDB unavailability represented as `error` messages in status bar).

## Impact

- Affected UI: `apps/ui/src/components/StatusBar.tsx` and related indicator component(s) in `apps/ui/src/components/`.
- Affected tests: status bar/component tests validating TMDB/TVDB states and badge/count rendering behavior.
- No backend/API contract changes; this is a frontend behavior and presentation update.
