## 1. Backend Discovery Enhancements

- [x] 1.1 Extend `apps/cli/src/utils/VideoCaptioner.ts` discovery candidates to include pip-installed Python `Scripts` paths (Windows-first patterns plus cross-platform equivalents).
- [x] 1.2 Preserve current discovery precedence and fallback behavior while integrating new Python candidate checks.
- [x] 1.3 Add/update backend tests for discovery success from Python `Scripts` paths and not-found behavior.

## 2. Settings UI Path Visibility

- [x] 2.1 Add/extend UI API wiring to fetch VideoCaptioner discover result for settings display.
- [x] 2.2 Add a new read-only item in `apps/ui/src/components/ui/settings/GeneralSettings.tsx` to show discovered VideoCaptioner path or unavailable state.
- [x] 2.3 Add/update UI tests for `GeneralSettings` path display in both available and unavailable scenarios.

## 3. Validation and Regression Checks

- [x] 3.1 Run targeted CLI/UI tests for VideoCaptioner discovery and settings updates.
- [x] 3.2 Verify no regressions in existing transcribe flow and discovery-based gating behavior.
