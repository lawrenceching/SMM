# Parallel TVDB Translation

## Purpose

Improve TVDB metadata fetch performance for series with many episodes by parallelizing episode-level translation requests.

## Requirements

### Requirement: Feature toggle controls parallel episode translation requests

The system SHALL read a localStorage key `feature.parallelTvdbTranslationRequest` to determine whether episode-level TVDB translation requests are sent in parallel or sequentially. The default behavior (key absent or set to `"true"`) SHALL use parallel requests via `Promise.allSettled`. Only when the key is explicitly set to `"false"` SHALL the system use sequential requests.

#### Scenario: Toggle absent (default behavior)
- **WHEN** `feature.parallelTvdbTranslationRequest` is not present in localStorage
- **THEN** all episode translation requests for a given series fetch SHALL be initiated concurrently via `Promise.allSettled`

#### Scenario: Toggle explicitly enabled
- **WHEN** `feature.parallelTvdbTranslationRequest` is set to `"true"` in localStorage
- **THEN** all episode translation requests for a given series fetch SHALL be initiated concurrently via `Promise.allSettled`

#### Scenario: Toggle explicitly disabled
- **WHEN** `feature.parallelTvdbTranslationRequest` is set to `"false"` in localStorage
- **THEN** episode translation requests SHALL be sent sequentially, one at a time

### Requirement: Parallel requests use Promise.allSettled

When parallel mode is active, the system SHALL use `Promise.allSettled` to dispatch all episode translation requests concurrently. Individual translation failures SHALL NOT cause the overall fetch to fail — the system SHALL fall back to the episode's default name, preserving the same per-episode error tolerance as the sequential path.

#### Scenario: All translations succeed
- **WHEN** parallel mode is enabled and all episode translation requests succeed
- **THEN** each episode SHALL receive its translated name from the corresponding response

#### Scenario: Some translations fail
- **WHEN** parallel mode is enabled and one or more episode translation requests fail
- **THEN** failed episodes SHALL fall back to their default (untranslated) name, and successful episodes SHALL still receive their translated names

### Requirement: Only episode translations are parallelized

The system SHALL NOT change the request pattern for non-episode TVDB API calls. Series translation, movie translation, series extended, season extended, search, and artwork type endpoints SHALL remain unchanged regardless of the toggle state.

#### Scenario: Series and movie translation calls remain sequential
- **WHEN** `feature.parallelTvdbTranslationRequest` is enabled
- **THEN** series-level and movie-level translation calls SHALL still execute as individual requests in their existing call order
