## Context

`fetchTvdbAndBuildTvShowMediaMetadata` in `TvdbUtils.ts` fetches TVDB metadata for a series: series extended info, season extended info, and episode data. Within the episode loop (lines 157–206), each episode that has a `nameTranslations` entry matching the target language triggers an individual `tvdb.episodeTranslationByLangCode(episode.id, tvdbLangCode)` call. These calls execute sequentially — for a series like One Piece (~1100+ episodes), this means 1100+ round-trips, each waiting on the last.

The project already uses TanStack Query (React Query) via `useTvdbQueries` hooks. The `queryClient.fetchQuery` pattern is already in use for individual translation fetches.

## Goals / Non-Goals

**Goals:**
- Allow episode translation requests to fire in parallel when the feature toggle is enabled
- Introduce a localStorage-based feature toggle `feature.parallelTvdbTranslationRequest` that defaults to `false`
- When the toggle is off, preserve the existing sequential behavior exactly
- Only affect episode translation calls — series, season, and movie translation calls remain as-is

**Non-Goals:**
- Changing the API client or transport layer
- Affecting movie translation (single call, no parallelization benefit)
- Affecting series/season metadata fetching (already parallel-amenable via TanStack Query)
- Adding any UI for the toggle (it is a developer/advanced-user toggle)
- Modifying `useTvdbQueries` or the TanStack Query hooks themselves

## Decisions

### Decision 1: Use `Promise.allSettled` for parallel execution

**Rationale:** `Promise.allSettled` ensures all translations fire concurrently and none of them block others. Unlike `Promise.all`, a single failed translation won't reject the entire batch — we already have per-episode `try/catch` fallback in the sequential path, so `allSettled` preserves that tolerance.

**Alternatives considered:**
- `Promise.all`: Would abort all translations if one fails, changing existing behavior where failures are tolerated per-episode.
- `p-limit` (concurrency-limited pool): Adds a dependency and complexity. Since the user explicitly asked for full parallelism via TanStack Query, simple `Promise.allSettled` is sufficient. The browser's own HTTP connection limits provide natural throttling (~6 per origin).

### Decision 2: localStorage toggle key

**Rationale:** `feature.parallelTvdbTranslationRequest` follows the established pattern for feature flags in this project. Defaulting to `false` means existing users see no behavior change. The toggle is checked at call time, not cached, so users can enable it mid-session.

### Decision 3: Gate at `fetchTvdbAndBuildTvShowMediaMetadata` level

**Rationale:** The function that orchestrates the episode loop is the natural gate point. It receives all the necessary context (TVDB client, language). Keeping the branching inside this function keeps the change minimal and avoids touching the callers in `useInitializeImportedMediaFolder.ts` or the searchbox.

### Decision 4: Do NOT touch series/season translation APIs

**Rationale:** Series translation (`seriesTranslationByLangCode`) is a single call per series. Movie translation is a single call per movie. These have no parallelism problem. The episode translation loop is the only bottleneck.

## Risks / Trade-offs

- **Rate limiting**: Sending many concurrent requests to the TVDB reverse proxy could trigger rate limits. → Mitigation: The toggle defaults to `false`; browser HTTP connection limits (~6 concurrent per origin) provide natural throttling; `allSettled` handles individual failures gracefully.
- **Memory pressure**: Storing many concurrent in-flight request objects for very large series. → Mitigation: Browser fetch request objects are lightweight; this is not a practical concern for even 1000+ episode series.
- **Toggle exposure**: localStorage toggle requires manual editing or console access to enable. → This is intentional — the toggle is for advanced users and testing. No UI is provided.
