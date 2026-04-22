## 1. MessageIndicator model and StatusBar integration

- [x] 1.1 Define `Message` typing in the UI component boundary (`title`, optional `link`, `type`) and replace connection-centric props with message array input.
- [x] 1.2 Refactor `StatusBar` to use `MessageIndicator` in place of the previous connection indicator wiring.
- [x] 1.3 Map TMDB/TVDB availability states to `Message[]`, emitting one `error` message per unavailable provider.

## 2. Badge behavior and rendering rules

- [x] 2.1 Implement warning/error actionable count logic that excludes `info` messages.
- [x] 2.2 Render red badge/dot count on the status icon using existing theme-compatible status bar styling.
- [x] 2.3 Ensure deterministic message ordering (TMDB then TVDB) to keep UI and tests stable.

## 3. Validation and regression coverage

- [x] 3.1 Add or update component tests to verify TMDB unavailable produces an `error` message.
- [x] 3.2 Add or update component tests to verify TVDB unavailable produces an `error` message.
- [x] 3.3 Add or update component tests for mixed severities to verify badge count includes only `warning` + `error`.
- [x] 3.4 Run relevant UI test suite and fix any regressions introduced by the indicator refactor.
