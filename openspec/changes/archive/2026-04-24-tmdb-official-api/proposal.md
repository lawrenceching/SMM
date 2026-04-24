## Why

SMM currently supports configuring TMDB host and API key, but does not fully define and guarantee runtime behavior for switching between proxy mode and direct TMDB access across all TMDB entry points. We need consistent, user-controlled routing now because TMDB requests happen in both initialization flows and search flows, and inconsistent routing can cause failed lookups or mismatched connectivity behavior.

## What Changes

- Define a unified TMDB endpoint routing behavior for UI: use SMM TMDB proxy when TMDB host is empty, and use direct browser calls to official TMDB API when TMDB host is configured.
- Apply this routing behavior to media import initialization paths, including media folder import and media library import event-driven workflows.
- Apply the same routing behavior to TMDB search features so search and initialization share the same connection mode semantics.
- Clarify required configuration dependencies for direct mode (TMDB host and API key) and expected fallback behavior when host is unset.

## Capabilities

### New Capabilities
- `tmdb-endpoint-routing`: Route TMDB requests by configuration so initialization and search use proxy mode by default and direct official API mode when TMDB host is set.

### Modified Capabilities
- None.

## Impact

- Affected UI components and hooks that trigger TMDB access in import initialization and media database search flows.
- Affected TMDB API client logic in the UI layer, especially request URL construction and configuration-based mode selection.
- May require updates to e2e coverage for config-driven behavior differences between proxy mode and direct mode.
