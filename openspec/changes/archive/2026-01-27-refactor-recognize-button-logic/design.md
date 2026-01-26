## Context

Currently, the `TvShowPanel` component has separate code paths for handling rule-based recognition (triggered by `onRecognizeButtonClick`) and AI-based recognition (triggered by backend WebSocket events). The rule-based flow directly manipulates local state and opens `openRuleBasedRecognizePrompt`, while AI-based flows update global state and open `openAiRecognizePrompt`.

The `UIRecognizeMediaFilePlan` type already includes a `tmp` property to distinguish temporary plans from persistent ones, but this capability is underutilized. The global states provider currently treats all plans uniformly, always calling the backend API to update plan status.

**Current State:**
- Rule-based recognition: Direct state mutation → `openRuleBasedRecognizePrompt` → manual season preview building
- AI-based recognition: Backend plan → global state → `openAiRecognizePrompt` → `updatePlan` API call
- Two separate prompts with similar functionality but different handlers

## Goals / Non-Goals

**Goals:**
- Unify rule-based and AI-based recognition flows using the `tmp` flag in `UIRecognizeMediaFilePlan`
- Simplify the `updatePlan` logic to handle temporary and persistent plans differently
- Reduce code duplication between `openRuleBasedRecognizePrompt` and `openAiRecognizePrompt`
- Maintain existing functionality and user experience

**Non-Goals:**
- Changing the backend API or plan persistence mechanism
- Modifying the AI recognition workflow from the backend
- Changing the visual appearance or behavior of prompts
- Altering how seasons are built or previewed

## Decisions

### 1. Temporary Plan Generation in Frontend

**Decision:** Generate temporary `UIRecognizeMediaFilePlan` objects with `tmp: true` in the frontend when `onRecognizeButtonClick` is triggered.

**Rationale:**
- Leverages existing `UIRecognizeMediaFilePlan` type and `tmp` property
- Allows both recognition types to flow through the same global state management
- Temporary plans don't need backend persistence, reducing unnecessary API calls
- Frontend can immediately add temporary plans to state without waiting for backend

**Alternatives Considered:**
- **Alternative A:** Create a separate state for temporary plans
  - Rejected: Would duplicate state management logic
- **Alternative B:** Always create persistent plans, even for rule-based
  - Rejected: Unnecessary disk I/O and backend API overhead for ephemeral UI state

### 2. Unified Prompt Selection Based on `tmp` Flag

**Decision:** Use a single `useEffect` that checks `pendingPlans` and opens the appropriate prompt based on the `tmp` property.

**Rationale:**
- Eliminates duplicate prompt-opening logic
- Single source of truth for which prompt should be displayed
- Easier to maintain and extend in the future

**Alternatives Considered:**
- **Alternative A:** Keep separate prompts and handlers
  - Rejected: Code duplication, harder to maintain
- **Alternative B:** Create a single prompt that handles both cases
  - Rejected: Would require larger refactoring of prompt components

### 3. Conditional `updatePlan` Logic

**Decision:** Modify `updatePlan` to check the `tmp` flag before calling the backend API:
- If `tmp: true`: Remove from local state only (no API call)
- If `tmp: false`: Call backend API to update status (existing behavior)

**Rationale:**
- Temporary plans are frontend-only and don't exist in backend
- Reduces unnecessary network traffic for temporary state
- Maintains existing behavior for persistent AI-based plans

**Alternatives Considered:**
- **Alternative A:** Always call backend API, even for temporary plans
  - Rejected: Would cause 404 errors for non-existent plans
- **Alternative B:** Create separate `removeTmpPlan` function
  - Rejected: Adds complexity; single function with conditional logic is cleaner

## Risks / Trade-offs

### Risk 1: Temporary Plans Lost on Page Refresh
**Risk:** Users with temporary rule-based recognition plans will lose them if they refresh the page.

**Mitigation:** This is acceptable behavior - rule-based recognition is a quick, user-initiated action that can be easily repeated. The plan is only needed for the preview session.

### Risk 2: State Desynchronization
**Risk:** If temporary plans aren't properly cleaned up, they could accumulate in global state.

**Mitigation:** Temporary plans are removed immediately after user confirmation/cancellation. Add cleanup in `useEffect` to remove orphaned temporary plans when media folder changes.

### Risk 3: Confusion Between Plan Types
**Risk:** Developers may not understand when to use `tmp: true` vs `tmp: false`.

**Mitigation:** Add clear comments and TypeScript documentation explaining the distinction. Consider adding a helper function `createTmpPlan()` to make intent explicit.

## Migration Plan

1. **Phase 1:** Update global states provider
   - Modify `updatePlan` to check `tmp` flag
   - Add `addTmpPlan` helper function to global states context

2. **Phase 2:** Update `TvShowPanel.tsx`
   - Create temporary plan in `onRecognizeButtonClick`
   - Add `addTmpPlan` to state
   - Remove direct call to `openRuleBasedRecognizePrompt`

3. **Phase 3:** Unify prompt detection
   - Modify `useEffect` to check `tmp` property
   - Route to appropriate prompt based on flag

4. **Phase 4:** Clean up
   - Remove unused `handleRuleBasedRecognizeConfirm` and related code
   - Update tests
   - Verify both flows work correctly

**Rollback Strategy:** Keep the old `openRuleBasedRecognizePrompt` code commented out for one release cycle, then remove in next commit.

## Open Questions

1. **Should temporary plans be persisted to session storage?**
   - Recommendation: No - not necessary for current use case
   - Can be added later if users request it

2. **Should we add a visual indicator to distinguish temporary vs persistent plans?**
   - Recommendation: No - users don't need to know the implementation detail
   - Focus on consistent UX instead

3. **How to handle temporary plan if AI-based plan arrives for same folder?**
   - Recommendation: Temporary plan should be auto-rejected/removed in favor of AI-based plan
   - This matches current behavior where AI-based recognition overrides manual input
