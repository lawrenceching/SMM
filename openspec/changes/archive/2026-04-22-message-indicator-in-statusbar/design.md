## Context

The status bar currently exposes TMDB and TVDB states through a connection-style indicator, which does not generalize well to multiple message severities and does not provide a clear attention mechanism. This change introduces a message-oriented model in the UI layer so service health issues can be surfaced as typed messages and aggregated into a warning/error badge on the status icon.

Constraints:
- Keep the scope limited to `StatusBar` and related indicator UI behavior.
- Reuse existing service availability data sources for TMDB/TVDB (no backend contract changes).
- Preserve current layout ergonomics in the desktop status bar.

## Goals / Non-Goals

**Goals:**
- Define a `Message` shape (`title`, optional `link`, `type`) as the input contract for status messages.
- Replace connection-centric rendering in `StatusBar` with `MessageIndicator` rendering.
- Represent TMDB and TVDB unavailability as `error` messages.
- Show a red badge/count on the status icon for `warning` + `error` messages only.
- Keep message behavior testable with deterministic rendering rules.

**Non-Goals:**
- Changing upstream discovery logic for TMDB/TVDB availability.
- Adding persistent storage for messages.
- Introducing new notification channels (system tray/toast/push).
- Refactoring unrelated status bar modules (e.g., background jobs indicator).

## Decisions

1. Use a message-first domain model at the UI boundary.
   - Decision: `StatusBar` composes an array of `Message` objects and passes it into `MessageIndicator`.
   - Rationale: This decouples data source logic from rendering and scales to future message sources.
   - Alternative considered: Keep connection-specific props and add ad-hoc warning fields. Rejected because it increases branching and makes future expansion harder.

2. Map TMDB/TVDB "unavailable" to `error` severity.
   - Decision: Each unavailable provider emits one `error` message with a concise title; optional external help link can be attached when known.
   - Rationale: The requirement explicitly treats TMDB/TVDB unavailability as errors and keeps one-message-per-provider semantics clear.
   - Alternative considered: Aggregate multiple provider failures into one combined error. Rejected because per-provider granularity is more actionable.

3. Badge count reflects only actionable severities.
   - Decision: Badge number = count of messages where `type` is `warning` or `error`; `info` is excluded.
   - Rationale: Avoids alert fatigue and aligns badge meaning with "needs attention".
   - Alternative considered: Count all messages. Rejected because informational messages would create noisy alerts.

4. Preserve visual consistency with existing status icon affordance.
   - Decision: Reuse the existing status bar icon footprint and overlay a red dot/count style for the actionable count.
   - Rationale: Minimal layout risk and lower user retraining cost.
   - Alternative considered: Add separate text label in status bar. Rejected due to limited horizontal space.

## Risks / Trade-offs

- [Risk] Badge style may conflict with Fluent UI theming in dark/light modes
  -> Mitigation: Use theme tokens and verify both themes in component tests/snapshots.

- [Risk] Inconsistent message ordering can cause test flakiness and UI jitter
  -> Mitigation: Use deterministic ordering (e.g., source order: TMDB then TVDB) before render.

- [Risk] Future message sources may overload a compact status bar control
  -> Mitigation: Keep rendering contract extensible and consider truncation/grouping rules in follow-up changes.

- [Trade-off] Message-based model adds a small abstraction layer
  -> Benefit: Cleaner API and easier extension compared with connection-specific branching.

## Migration Plan

1. Introduce/rename UI component logic from connection indicator to `MessageIndicator` in the status bar area.
2. Map existing TMDB/TVDB availability states to `Message[]` with `error` for unavailable providers.
3. Implement badge count computation for `warning` and `error`.
4. Update or add tests for:
   - TMDB unavailable -> error message shown
   - TVDB unavailable -> error message shown
   - Mixed severities -> badge counts only warning/error
5. Validate in the desktop UI and keep rollback simple by restoring prior indicator wiring if regressions appear.

Rollback strategy:
- Revert `StatusBar` to the prior connection indicator wiring and disable message badge rendering.

## Open Questions

- Should unavailable TMDB/TVDB messages include default documentation links immediately, or be left optional until help pages are finalized?
- When warning and error coexist, should the icon styling prioritize `error` semantics (color/intensity) beyond numeric count?
