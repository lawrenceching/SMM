## 1. Global States Provider Updates

- [x] 1.1 Modify `updatePlan` function to check `tmp` flag before calling backend API
  - If `tmp: true`, remove from local state only (no API call)
  - If `tmp: false`, call backend API (existing behavior)
- [x] 1.2 Add `addTmpPlan` helper function to `GlobalStatesContextValue` interface
  - Function signature: `(plan: UIRecognizeMediaFilePlan) => void`
  - Adds temporary plan to `pendingPlans` state
- [x] 1.3 Implement `addTmpPlan` in `GlobalStatesProvider`
  - Generate UUID for plan.id if not provided
  - Ensure `tmp` is set to `true`
  - Add plan to `pendingPlans` state array
- [x] 1.4 Add cleanup logic to remove orphaned temporary plans
  - Remove temporary plans when media folder changes
  - Run in `useEffect` that depends on `mediaMetadata?.mediaFolderPath`

## 2. TvShowPanel Recognition Flow

- [x] 2.1 Modify `onRecognizeButtonClick` to create temporary `UIRecognizeMediaFilePlan`
  - Generate plan structure with `tmp: true`
  - Populate `files` array with recognized episode mappings
  - Set `mediaFolderPath` from current media metadata
- [x] 2.2 Call `addTmpPlan` from `onRecognizeButtonClick`
  - Pass the created temporary plan to global state
  - Remove direct call to `openRuleBasedRecognizePrompt`
- [x] 2.3 Remove `handleRuleBasedRecognizeConfirm` and `handleRuleBasedRecognizeCancel`
  - Logic will be handled by unified prompt flow
- [x] 2.4 Update `useEffect` that monitors `pendingPlans` to check `tmp` property
  - Route to rule-based prompt if `tmp: true`
  - Route to AI-based prompt if `tmp: false`
  - Build seasons preview based on plan data

## 3. Unified Prompt Logic

- [x] 3.1 Modify prompt detection `useEffect` to handle both plan types
  - Find plan matching current media folder
  - Check `plan.tmp` property to determine prompt type
- [x] 3.2 Update prompt confirmation handlers to use unified `updatePlan`
  - Rule-based: calls `updatePlan` with temporary plan (local removal only)
  - AI-based: calls `updatePlan` with persistent plan (API call)
- [x] 3.3 Ensure seasons preview is built correctly for both plan types
  - Use `buildSeasonsByRecognizeMediaFilePlan` for both
  - Pass plan data to prompt components

## 4. Type Safety and Documentation

- [x] 4.1 Add JSDoc comments to `addTmpPlan` function
  - Document that it's for temporary, frontend-only plans
  - Explain `tmp` flag usage
- [x] 4.2 Add comments to `updatePlan` explaining conditional logic
  - Document behavior difference for temporary vs persistent plans
- [x] 4.3 Update `UIRecognizeMediaFilePlan` type documentation if needed
  - Ensure `tmp` property is well-documented

## 5. Testing

- [ ] 5.1 Test rule-based recognition creates temporary plan
  - Verify plan has `tmp: true`
  - Verify plan is added to global state
  - Verify no backend API call is made
- [ ] 5.2 Test rule-based prompt displays correctly
  - Verify prompt opens when temporary plan is detected
  - Verify seasons preview shows correct data
- [ ] 5.3 Test temporary plan confirmation flow
  - Verify plan is removed from state after confirmation
  - Verify recognition is applied to media metadata
  - Verify no API call is made
- [ ] 5.4 Test temporary plan cancellation flow
  - Verify plan is removed from state after cancellation
  - Verify media metadata is not modified
  - Verify no API call is made
- [ ] 5.5 Test AI-based recognition still works
  - Verify persistent plans (tmp: false) still trigger API calls
  - Verify AI-based prompt displays correctly
- [ ] 5.6 Test orphaned plan cleanup
  - Verify temporary plans are removed when media folder changes
  - Verify persistent plans are retained across folder changes

## 6. Cleanup and Refactoring

- [ ] 6.1 Remove `openRuleBasedRecognizePrompt` from prompts context
  - Or mark as deprecated if still used elsewhere
- [ ] 6.2 Remove `handleRuleBasedRecognizeConfirm` and `handleRuleBasedRecognizeCancel` callbacks
  - These are no longer needed with unified flow
- [ ] 6.3 Remove any duplicate code or comments that are now obsolete
- [ ] 6.4 Update inline comments to reflect new unified flow
- [ ] 6.5 Run ESLint and fix any warnings
- [x] 6.6 Verify TypeScript compilation with no errors

## 7. Documentation Updates

- [ ] 7.1 Update AI-driven-recognition.md documentation if needed
  - Document the unified recognition flow
  - Explain temporary vs persistent plans
- [ ] 7.2 Add comments to code explaining architectural decisions
  - Why temporary plans don't persist
  - How the unified flow simplifies maintenance
