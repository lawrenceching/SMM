## 1. Feature toggle

- [x] 1.1 Add `feature.parallelTvdbTranslationRequest` localStorage read in `TvdbUtils.ts` with a helper function `isParallelTranslationEnabled()` that returns `localStorage.getItem("feature.parallelTvdbTranslationRequest") === "true"`

## 2. Core parallelization

- [x] 2.1 In `fetchTvdbAndBuildTvShowMediaMetadata`, collect all episode translation promises into an array (for episodes where `nameTranslations` includes the target language code)
- [x] 2.2 When the feature toggle is enabled, dispatch all collected promises concurrently via `Promise.allSettled`
- [x] 2.3 When the feature toggle is disabled (default), preserve the existing sequential `for...of` loop with inline `await`
- [x] 2.4 Map `allSettled` results back to episode names: fulfilled responses use the translated name, rejected fall back to the default episode name

## 3. Verification

- [x] 3.1 Manually verify sequential behavior (toggle off/absent) produces correct results for a series with 50+ episodes
- [x] 3.2 Manually verify parallel behavior (toggle enabled via localStorage) produces identical translation results
- [x] 3.3 Verify no regression in movie metadata fetching (translation calls remain single-request)
