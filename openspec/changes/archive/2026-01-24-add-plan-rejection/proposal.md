# Change: Add Plan Rejection Feature

## Why

Currently, when AI agents create media file recognition plans, users can only confirm them. There's no way for users to reject a plan if they don't agree with the AI's recognition results. This creates a poor user experience when the AI makes mistakes or the user wants to cancel the operation. Additionally, plans are created without UUIDs in their `id` field, making it difficult to uniquely identify and manage plans.

## What Changes

- **MODIFIED**: Plans SHALL include a UUID in the `id` field when created by AI agents
- **ADDED**: API endpoint `/api/rejectPlan` to allow users to reject recognition plans
- **ADDED**: Frontend integration to call the reject API when user clicks cancel in AiRecognizePrompt
- **MODIFIED**: Plan status SHALL be updated to "rejected" when rejection API is called

## Impact

- Affected specs: `ai-tools` (modified to add UUID requirement and rejection capability)
- Affected code:
  - `cli/src/tools/recognizeMediaFilesTool.ts` - Add UUID to plan creation
  - `cli/src/tools/recognizeMediaFilesTask.ts` - Ensure UUID is set
  - `cli/src/route/RejectPlan.ts` - New API endpoint (to be created)
  - `cli/server.ts` - Register new route handler
  - `ui/src/components/TvShowPanel.tsx` - Call reject API on cancel
  - `ui/src/api/rejectPlan.ts` - New API client function (to be created)
  - `core/types/RecognizeMediaFilePlan.ts` - Already has `id` and `status: "rejected"` fields
