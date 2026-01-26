## Why

The current implementation of `onRecognizeButtonClick` has different code paths for rule-based and AI-based recognition, creating unnecessary complexity. The `UIRecognizeMediaFilePlan` type already has a `tmp` property to distinguish between temporary rule-based plans and persistent AI-based plans, but this isn't being leveraged effectively. Unifying the logic will simplify maintenance and reduce code duplication.

## What Changes

- **Modified**: `onRecognizeButtonClick` will generate a temporary `UIRecognizeMediaFilePlan` with `tmp: true` for rule-based recognition
- **New**: Global state will track temporary plans alongside persistent AI-based plans
- **Modified**: UI will detect pending `UIRecognizeMediaFilePlan` and display appropriate prompt based on `tmp` property
- **Modified**: `updatePlan` logic will handle:
  - Temporary plans (`tmp: true`): remove from state without API call
  - Persistent plans (`tmp: false`): call backend API to update status
- **Simplified**: Single unified flow for both recognition types, differentiated only by the `tmp` flag

## Capabilities

### New Capabilities
- `ui-recognition-state-management`: Unified state management for both temporary (rule-based) and persistent (AI-based) recognition plans using the `tmp` flag

### Modified Capabilities
- None - this is an internal refactoring that doesn't change external requirements

## Impact

**Affected Code:**
- `ui/src/components/TvShowPanel.tsx` - `onRecognizeButtonClick` handler and `updatePlan` logic
- `ui/src/providers/global-states-provider.tsx` - state management for pending plans
- `ui/src/components/TvShowPanelPrompts.tsx` - prompt selection logic

**API Integration:**
- No backend API changes required
- AI-based plans continue to use existing `/api/updatePlan` endpoint
- Rule-based temporary plans bypass API calls entirely

**Dependencies:**
- Uses existing `UIRecognizeMediaFilePlan` type with `tmp` property
- No new dependencies introduced
