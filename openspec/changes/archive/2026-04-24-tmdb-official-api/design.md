## Context

SMM has two runtime paths that request TMDB data from the UI: (1) import-time initialization flows triggered by media folder/media library import events, and (2) user-initiated TMDB search from the media database search box. Although TMDB host and API key are already configurable, request routing behavior is not formalized across both paths, which can produce inconsistent connectivity behavior between proxy and direct modes.

The existing desired product behavior is:
- If TMDB host is unset, use SMM's TMDB proxy endpoint.
- If TMDB host is set, call the configured TMDB host directly from the browser with API key authentication.

This is a cross-cutting UI change because multiple components and hooks rely on a shared TMDB API layer.

## Goals / Non-Goals

**Goals:**
- Enforce a single TMDB endpoint routing rule used by all UI TMDB calls.
- Ensure import initialization and search flows both honor the same proxy/direct mode switch.
- Keep user configuration as the source of truth for TMDB routing decisions.
- Preserve current UX while improving predictability of TMDB connectivity.

**Non-Goals:**
- Redesigning TMDB-related UI settings or adding new settings fields.
- Changing TMDB metadata mapping/business logic outside endpoint selection.
- Introducing new backend proxy capabilities beyond current proxy behavior.

## Decisions

### 1) Centralize endpoint resolution in TMDB API layer
- **Decision**: Keep endpoint selection logic in the UI TMDB API abstraction (instead of duplicating checks in each caller).
- **Rationale**: Both initialization and search should consume one routing contract; centralization reduces divergence and future regressions.
- **Alternatives considered**:
  - Per-call branching in each hook/component: rejected due to duplication and drift risk.
  - Backend-only switching: rejected because direct official API mode is intentionally browser-side when host is provided.

### 2) Configuration-driven mode selection
- **Decision**: Derive runtime mode purely from user config values already present:
  - `tmdbHost` empty -> proxy mode
  - `tmdbHost` non-empty -> direct mode
- **Rationale**: This matches existing product intent and requires no schema migration.
- **Alternatives considered**:
  - Add explicit `tmdbConnectionMode` enum: rejected to avoid unnecessary config complexity.

### 3) Apply same routing contract to both TMDB entry paths
- **Decision**: Ensure event-driven import initialization and search workflows call the same TMDB API functions or shared request builder.
- **Rationale**: One execution contract across both paths is required by feature intent and avoids behavior mismatch.
- **Alternatives considered**:
  - Separate API clients per feature: rejected because it increases maintenance cost and inconsistency risk.

### 4) Fail fast on invalid direct configuration
- **Decision**: In direct mode, require API requests to include API key and valid host URL generation; surface errors through existing UI error handling channels.
- **Rationale**: Makes misconfiguration obvious and easier to troubleshoot.
- **Alternatives considered**:
  - Silent fallback to proxy on partial direct config: rejected because it hides configuration mistakes and causes surprising behavior.

## Risks / Trade-offs

- **[Risk] Direct-mode CORS/network differences across environments** -> **Mitigation**: rely on configurable host and existing connectivity feedback/error messaging; document expected host requirements.
- **[Risk] Regression in one TMDB entry path while fixing the other** -> **Mitigation**: add or update e2e coverage for both import initialization and search scenarios under proxy/direct configurations.
- **[Risk] Existing callers bypass shared TMDB API utility** -> **Mitigation**: audit known TMDB call sites in import handlers and search components during implementation.
- **[Trade-off] Strict config-driven mode without hidden fallback** -> clearer behavior but more visible user errors for misconfigured direct mode.

## Migration Plan

1. Implement endpoint routing consolidation in UI TMDB API utilities.
2. Update import initialization path callers to use the shared routing behavior.
3. Update search path callers to use the same shared behavior.
4. Add/adjust tests covering:
   - proxy mode when host is empty
   - direct mode when host is set
5. Verify no behavior change outside TMDB endpoint selection.

Rollback strategy:
- Revert the routing consolidation changes and restore previous request construction paths in UI TMDB callers.

## Open Questions

- Should direct mode enforce additional host validation at settings-save time, or remain runtime-validated at request time?
- Do we need explicit user-facing diagnostics when direct mode fails due to CORS vs authentication, or are current error surfaces sufficient?
