## 1. Backend Implementation

- [ ] 1.1 Modify `beginRecognizeTask` in `cli/src/tools/recognizeMediaFilesTool.ts`:
  - [ ] Generate UUID using `crypto.randomUUID()`
  - [ ] Set the `id` field in the plan object to the generated UUID
  - [ ] Ensure the plan file includes the UUID when saved

- [ ] 1.2 Create `cli/src/route/RejectPlan.ts`:
  - [ ] Implement `processRejectPlan` function that:
    - [ ] Accepts plan ID in request body
    - [ ] Reads the plan file by ID
    - [ ] Validates plan exists and is in "pending" status
    - [ ] Updates plan status to "rejected"
    - [ ] Writes updated plan back to file
    - [ ] Returns success/error response following API design guidelines
  - [ ] Implement `handleRejectPlan` route handler following template from `cli/docs/ApiDesignGuideline.md`
  - [ ] Use Zod schema for request validation

- [ ] 1.3 Register route in `cli/server.ts`:
  - [ ] Import `handleRejectPlan` from `./src/route/RejectPlan`
  - [ ] Call `handleRejectPlan(this.app)` in `setupRoutes()` method

- [ ] 1.4 Add helper function in `cli/src/tools/recognizeMediaFilesTool.ts`:
  - [ ] Create `rejectPlan(planId: string): Promise<void>` function
  - [ ] Function should read plan, validate status, update to "rejected", and save

## 2. Frontend Implementation

- [ ] 2.1 Create `ui/src/api/rejectPlan.ts`:
  - [ ] Implement `rejectPlan(planId: string, signal?: AbortSignal)` function
  - [ ] Follow pattern from `ui/src/api/getPendingPlans.ts`
  - [ ] POST to `/api/rejectPlan` with plan ID in request body
  - [ ] Return typed response with `data` and `error` fields

- [ ] 2.2 Update `ui/src/components/TvShowPanel.tsx`:
  - [ ] Import `rejectPlan` API function
  - [ ] Modify `onCancel` callback in `openAiRecognizePrompt` call (around line 315-318)
  - [ ] Call `rejectPlan(plan.id)` when cancel is clicked
  - [ ] Handle errors appropriately (show toast or log)

## 3. Testing

- [ ] 3.1 Test UUID generation:
  - [ ] Verify plans created by `beginRecognizeTask` have UUID in `id` field
  - [ ] Verify UUID is persisted in plan file

- [ ] 3.2 Test reject API:
  - [ ] Create unit test for `processRejectPlan` function
  - [ ] Test with valid plan ID
  - [ ] Test with non-existent plan ID
  - [ ] Test with already rejected plan
  - [ ] Verify plan status is updated correctly

- [ ] 3.3 Test frontend integration:
  - [ ] Verify cancel button calls reject API
  - [ ] Verify error handling works correctly
  - [ ] Verify UI updates appropriately after rejection

## 4. Validation

- [ ] 4.1 Run `openspec validate add-plan-rejection --strict` and fix any issues
- [ ] 4.2 Verify all tasks are completed
- [ ] 4.3 Test end-to-end: Create plan → Cancel → Verify plan is rejected
