## Why

When fetching TVDB metadata for a TV series, the current implementation requests episode translations one-by-one in a sequential nested loop. For series with many episodes (e.g., long-running shows with hundreds of episodes across multiple seasons), this adds significant latency — each translation API call must complete before the next one begins. Parallelizing these requests will dramatically reduce total fetch time for large series.

## What Changes

- Parallelize episode translation requests in `fetchTvdbAndBuildTvShowMediaMetadata` using `Promise.allSettled` or equivalent, so all episode translations for all seasons fire concurrently
- Add a localStorage feature toggle `feature.parallelTvdbTranslationRequest` (default: `false`) to gate the parallel behavior
- When the toggle is off, preserve the existing sequential behavior exactly
- Only translation API calls are affected — all other TVDB API calls (series extended, season extended, search, etc.) remain unchanged

## Capabilities

### New Capabilities

- `parallel-tvdb-translation`: Parallelize episode-level TVDB translation requests behind a user-configurable feature toggle, with a fallback to sequential requests when the toggle is off

### Modified Capabilities

None — this is purely an internal performance optimization. No existing spec-level behaviors change.

## Impact

- `apps/ui/src/lib/TvdbUtils.ts` — `fetchTvdbAndBuildTvShowMediaMetadata`: refactor episode translation loop to support parallel mode
- `apps/ui/src/hooks/useTvdbQueries.ts` — minor: `getEpisodeTranslationByLangCode` already exists as a useCallback returning a promise, reusable as-is
- User config / feature toggle system — add localStorage key `feature.parallelTvdbTranslationRequest` (default `false`)
