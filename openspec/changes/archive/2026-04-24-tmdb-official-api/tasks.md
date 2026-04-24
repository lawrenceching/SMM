## 1. TMDB Routing Foundation

- [x] 1.1 Audit TMDB API request construction in `apps/ui/src/api/tmdb.ts` and identify the shared endpoint-resolution entry point.
- [x] 1.2 Implement unified mode selection logic (empty `tmdbHost` -> proxy, non-empty `tmdbHost` -> direct host) in shared TMDB request utilities.
- [x] 1.3 Ensure direct-mode requests include required API key and fail with explicit error when direct configuration is invalid.

## 2. Import Initialization Integration

- [x] 2.1 Update TMDB calls used during media folder import initialization to use the unified endpoint routing behavior.
- [x] 2.2 Update TMDB calls used during media library import initialization to use the unified endpoint routing behavior.
- [x] 2.3 Verify import event listener flows call shared TMDB API utilities rather than duplicated endpoint logic.

## 3. TMDB Search Integration

- [x] 3.1 Update `MediaDatabaseSearchbox` TMDB search calls to use the same shared endpoint routing behavior.
- [x] 3.2 Validate proxy-mode and direct-mode search request URL/parameter construction paths.

## 4. Validation and Regression Coverage

- [x] 4.1 Add or update tests for proxy-mode behavior when `tmdbHost` is empty.
- [x] 4.2 Add or update tests for direct-mode behavior when `tmdbHost` is configured.
- [x] 4.3 Run targeted UI/e2e verification for both initialization and search flows to confirm no regressions beyond endpoint routing.
