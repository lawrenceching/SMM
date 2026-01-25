# AI-Driven Recognition Flow

This document describes how the **AI-driven media file recognition** feature works: the AI produces a plan (season/episode per file), the backend persists it and notifies the UI, and the UI shows a review prompt and applies or rejects the plan.

## Overview

1. **AI generates a plan** – During a chat turn, the model uses tools to start a task, add recognized files (path + season + episode), and end the task. The backend writes a plan to disk and broadcasts that it is ready.
2. **UI fetches plans and shows prompt** – The app loads pending plans on startup (and after certain actions). When a pending plan matches the current media folder, the TV Show panel opens a confirmation prompt with a preview. The user can confirm (apply) or cancel (reject).

---

## 1. Data model and events

### Plan type

**File:** `core/types/RecognizeMediaFilePlan.ts`

- **`RecognizedFile`** – `{ season, episode, path }` (path in POSIX).
- **`RecognizeMediaFilePlan`** – Plan created and updated by the recognition tools:
  - `id` – Plan UUID.
  - `task` – `"recognize-media-file"`.
  - `status` – `"pending" | "completed" | "rejected"`.
  - `mediaFolderPath` – Media folder in POSIX.
  - `files` – Array of `RecognizedFile`.

### Plan-ready event

**File:** `core/event-types.ts`

- **`RecognizeMediaFilePlanReady`** – `{ event: 'recognizeMediaFilePlanReady' }`.
- **`RecognizeMediaFilePlanReadyRequestData`** – `{ taskId, planFilePath }` (plan file path in POSIX). Emitted when the backend has finished building the plan so the UI can refresh and show it.

---

## 2. Backend: AI tools and plan storage

### Chat and tools registration

**File:** `cli/tasks/ChatTask.ts`

- Handles `/api/chat` and runs `streamText()` with the AI model.
- Registers the recognize tools so the model can create and finalize a plan:
  - `beginRecognizeTask` – `createBeginRecognizeTaskTool(clientId, abortSignal)`
  - `addRecognizedMediaFile` – `createAddRecognizedMediaFileTool(clientId, abortSignal)`
  - `endRecognizeTask` – `createEndRecognizeTaskTool(clientId, abortSignal)`

Tools are created in `cli/src/tools/recognizeMediaFilesTask.ts` and re-exported from `cli/src/tools/index.ts`.

### Tool implementations (task layer)

**File:** `cli/src/tools/recognizeMediaFilesTask.ts`

- **`createBeginRecognizeTaskTool`**  
  - Input: `mediaFolderPath`.  
  - Calls `beginRecognizeTask(mediaFolderPath)` and returns `{ taskId }` (or `{ error }`).

- **`createAddRecognizedMediaFileTool`**  
  - Input: `taskId`, `season`, `episode`, `path`.  
  - Calls `addRecognizedMediaFile(taskId, { season, episode, path })`.

- **`createEndRecognizeTaskTool`**  
  - Input: `taskId`.  
  - Ensures the task exists and has at least one file, then calls `endRecognizeTask(taskId)` to persist and notify the UI. Returns `{ error }` if task missing or empty.

Paths are normalized to POSIX via `Path.posix()` before calling the core layer.

### Plan storage and broadcast (core tool layer)

**File:** `cli/src/tools/recognizeMediaFilesTool.ts`

Plans are stored under the user data directory in a `plans/` folder as `{taskId}.plan.json`.

- **`beginRecognizeTask(mediaFolderPath)`**  
  - Creates new `taskId` and `planId`, writes a new plan with `status: "pending"` and `files: []`, returns `taskId`.

- **`addRecognizedMediaFile(taskId, file)`**  
  - Loads the plan, appends one `RecognizedFile` (path in POSIX), saves.

- **`endRecognizeTask(taskId)`**  
  - Loads the plan, then calls `broadcast({ event: RecognizeMediaFilePlanReady.event, data: { taskId, planFilePath } })` so clients know a new plan is ready.

- **`getTask(taskId)`**  
  - Returns the plan for a task, or `undefined` if missing.

- **`updatePlanStatus(planId, status)`**  
  - Sets plan `status` to `"rejected"` or `"completed"`. Only plans in `"pending"` can be updated. Used when the user confirms or cancels in the UI.

- **`getAllPendingTasks()`**  
  - Scans `plans/*.plan.json`, returns all plans with `task === "recognize-media-file"` and `status === "pending"`. Used by the “get pending plans” API.

---

## 3. Backend: HTTP API

- **`POST /api/getPendingPlans`**  
  - **Handler:** `cli/src/route/GetPendingPlans.ts`  
  - Calls `getAllPendingTasks()` from `recognizeMediaFilesTool` and returns `{ data: RecognizeMediaFilePlan[] }`.

- **`POST /api/updatePlan`**  
  - **Handler:** `cli/src/route/UpdatePlan.ts`  
  - Body: `{ planId, status }` with `status in ['rejected','completed']`. Calls `updatePlanStatus(planId, status)` in `recognizeMediaFilesTool`. Returns `{ data: { success: true } }` or `{ error }`.

---

## 4. Frontend: Loading and updating plans

**File:** `ui/src/providers/global-states-provider.tsx`

- **`pendingPlans`** – List of pending `RecognizeMediaFilePlan[]`.
- **`fetchPendingPlans()`** – Calls `getPendingPlans()` and sets `pendingPlans` from `response.data`. Run on provider mount and after a failed `updatePlan` to resync.
- **`updatePlan(planId, status)`** – Optimistically removes the plan from `pendingPlans`, calls `updatePlan` API (`ui/src/api/updatePlan.ts`). On API failure, refetches pending plans and shows a toast.

**Files:** `ui/src/api/getPendingPlans.ts`, `ui/src/api/updatePlan.ts`  
- `getPendingPlans()` → `POST /api/getPendingPlans`.  
- `updatePlan(planId, status)` → `POST /api/updatePlan` with `{ planId, status }`.

---

## 5. Frontend: TV Show panel and review prompt

**File:** `ui/src/components/TvShowPanel.tsx`

- Uses `useGlobalStates()` for `pendingPlans` and `updatePlan`, and `usePrompts()` for `openAiRecognizePrompt`.
- **Effect when `pendingPlans` or `mediaMetadata?.mediaFolderPath` changes:**
  - Finds a plan with `task === "recognize-media-file"`, `status === 'pending'`, and `plan.mediaFolderPath === mediaMetadata.mediaFolderPath`.
  - If found:
    - Builds a season/episode preview with `buildSeasonsByRecognizeMediaFilePlan(mediaMetadata, plan)` and sets `seasonsForPreview`.
    - Opens the AI recognize prompt via `openAiRecognizePrompt` with:
      - `status: "wait-for-ack"`, confirm/cancel labels, and callbacks.
      - **onConfirm:** `handleAiRecognizeConfirm(plan)`.
      - **onCancel:** `updatePlan(plan.id, 'rejected')`.

- **`handleAiRecognizeConfirm(plan)`:**
  - Ensures `plan.mediaFolderPath === mediaMetadata.mediaFolderPath`.
  - Calls `updatePlan(plan.id, 'completed')`.
  - Calls `applyRecognizeMediaFilePlan(plan, mediaMetadata, updateMediaMetadata, { traceId })` to write recognition into media metadata.
  - Shows success/error toasts.

Preview state is used so that while the AI recognize prompt is open, the episode list reflects the plan (`seasonsForPreview` when `isAiRecognizePromptOpen`).

**File:** `ui/src/components/TvShowPanelPrompts.tsx`

- **`openAiRecognizePrompt({ status, confirmButtonLabel, confirmButtonDisabled, isRenaming, onConfirm, onCancel })`**  
  - Closes other prompts, sets AI-recognize prompt state (status, labels, callbacks), opens the AI recognize prompt (`setIsAiRecognizePromptOpen(true)`).
- **`AiBasedRecognizePrompt`**  
  - Renders the modal that shows the plan preview and Confirm/Cancel. On confirm it calls `onConfirm` (which triggers `handleAiRecognizeConfirm`); on cancel it calls `onCancel` (which rejects the plan).

---

## 6. Frontend: Building preview and applying the plan

**File:** `ui/src/components/TvShowPanelUtils.ts`

- **`buildSeasonsByRecognizeMediaFilePlan(mm, plan)`**  
  - Groups `plan.files` by season/episode, resolves TMDB season/episode from `mm.tmdbTvShow`, and builds `SeasonModel[]` with `FileProps` (video + associated files) for each episode. Used to show the “what will change” preview in the prompt.

- **`applyRecognizeMediaFilePlan(plan, mediaMetadata, updateMediaMetadata, { traceId })`**  
  - For each `plan.files` item, updates `mediaMetadata.mediaFiles` via `updateMediaFileMetadatas(..., path, season, episode)`, then calls `updateMediaMetadata(mediaFolderPath, updatedMetadata, { traceId })` so the recognition is persisted.

---

## 7. End-to-end flow (summary)

1. User asks the AI (e.g. in the Assistant) to recognize files in a media folder.
2. Model uses **beginRecognizeTask(mediaFolderPath)** → gets `taskId`.
3. Model uses **addRecognizedMediaFile(taskId, season, episode, path)** for each file.
4. Model uses **endRecognizeTask(taskId)** → plan is written under `plans/{taskId}.plan.json` and **RecognizeMediaFilePlanReady** is broadcast.
5. UI has already run **fetchPendingPlans()** on mount (and after failed `updatePlan`). Pending plans come from **getPendingPlans** → **getAllPendingTasks()** (files on disk).
6. When the user is on the TV Show panel for that folder, the effect finds the matching pending plan, builds **seasonsForPreview** with **buildSeasonsByRecognizeMediaFilePlan**, and calls **openAiRecognizePrompt** so the user sees the preview and Confirm/Cancel.
7. **Confirm** → **updatePlan(plan.id, 'completed')** and **applyRecognizeMediaFilePlan**.
8. **Cancel** → **updatePlan(plan.id, 'rejected')**.

---

## 8. Real-time updates (optional improvement)

The backend emits **RecognizeMediaFilePlanReady** when a plan is ready. The UI does not yet subscribe to this event. To show new plans without reload:

- In the same place other socket events are handled (e.g. `main.tsx` or `App.tsx` **WebSocketHandlers**), add a handler for `message.event === RecognizeMediaFilePlanReady.event`.
- From that handler, call **fetchPendingPlans()** from **useGlobalStates()** (or pass **fetchPendingPlans** into the component that registers the socket listener so it can refetch when the event is received).

---

## 9. Key files quick reference

| Layer / role         | Path |
|----------------------|------|
| Plan types           | `core/types/RecognizeMediaFilePlan.ts` |
| Plan-ready event     | `core/event-types.ts` (`RecognizeMediaFilePlanReady`) |
| Chat + tool wiring   | `cli/tasks/ChatTask.ts` |
| Recognize tools      | `cli/src/tools/recognizeMediaFilesTask.ts` |
| Plan I/O + broadcast | `cli/src/tools/recognizeMediaFilesTool.ts` |
| Get pending plans API| `cli/src/route/GetPendingPlans.ts` |
| Update plan API      | `cli/src/route/UpdatePlan.ts` |
| Pending plans state  | `ui/src/providers/global-states-provider.tsx` |
| Get/update plan API  | `ui/src/api/getPendingPlans.ts`, `ui/src/api/updatePlan.ts` |
| TV panel + effect    | `ui/src/components/TvShowPanel.tsx` |
| Prompt + openers     | `ui/src/components/TvShowPanelPrompts.tsx` |
| Preview + apply      | `ui/src/components/TvShowPanelUtils.ts` (`buildSeasonsByRecognizeMediaFilePlan`, `applyRecognizeMediaFilePlan`) |
