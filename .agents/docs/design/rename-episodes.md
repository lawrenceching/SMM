# Rename Episodes in SMM

There are 3 sources of renaming episodes operation in SMM:
1. UI
2. Build-in AI Assistant
3. MCP tool

## Current Implementation

### UI RuleBasedRename

The UI RuleBasedRename flow allows users to rename TV show episodes using predefined naming rules (Plex or Emby).

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (UI)                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ TVShowHeader │───►│    Prompt    │───►│ useTvShow    │              │
│  │  (Rename Btn)│    │   Dialog     │    │   Renaming   │              │
│  └──────────────┘    └──────────────┘    └──────┬───────┘              │
│       ▲                   ▲                     │                       │
│       │                   │                     │                       │
│       └───────────────────┘                     │                       │
│               useTvShowFileNameGeneration        │                       │
│                  (Preview Generation)            │                       │
│                                                  │                       │
│                           POST /api/renameFiles  │                       │
│                           (with mediaFolder)     │                       │
│                                                  ▼                       │
└──────────────────────────────────────────────────┼───────────────────────┘
                                                   │
┌──────────────────────────────────────────────────┼───────────────────────┐
│                         Backend (CLI)            │                       │
│                         ┌────────────▼─────────┐ │                       │
│                         │  handleRenameFiles   │◄┘                       │
│                         └──────────┬───────────┘                         │
│                                    │                                      │
│                     ┌──────────────┼──────────────┐                      │
│                     ▼              ▼              ▼                      │
│              ┌────────────┐ ┌──────────────┐ ┌────────────────────┐     │
│              │ validate   │ │ executeBatch │ │ updateMetadata     │     │
│              │ RenameOps  │ │ RenameOps    │ │ AndBroadcast       │     │
│              └────────────┘ └──────────────┘ └─────────┬──────────┘     │
│                                                         │                 │
│                                              Socket.IO  │ broadcast       │
│                                              ──────────►│mediaMetadata   │
│                                                         │Updated         │
└─────────────────────────────────────────────────────────┼───────────────┘
                                                          │
                                                          │ mediaMetadataUpdated
                                                          ▼
┌─────────────────────────────────────────────────────────┼───────────────┐
│                           Frontend (UI)                 │               │
│                                                         │               │
│                                                refreshMediaMetadata()   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Flow Sequence

1. **User Initiation**
   - User clicks "Rename" button in [TVShowHeader](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\tv-show-header.tsx)
   - Button triggers `openRuleBasedRenameFilePrompt` with toolbar options (plex/emby) and confirm/cancel callbacks

2. **Prompt Dialog Opens**
   - [RuleBasedRenameFilePrompt](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\stores\tvShowPromptsStore.ts#L232-L252) dialog is displayed
   - User selects naming rule (Plex or Emby)

3. **File Name Generation (Preview)**
   - When prompt opens, [useTvShowFileNameGeneration](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\hooks\useTvShowFileNameGeneration.ts) hook detects state change
   - Calls `generateNewFileNames(selectedNamingRule)` to generate preview names for all episodes
   - For each episode:
     - Calls `newFileName` API to generate new path based on selected rule
     - Updates `videoFile.newPath` with generated absolute path
     - Generates new paths for associated files (subtitles, audio, nfo, poster, etc.) using `newPath` helper function
   - Updates seasons state with new file paths for preview display

4. **User Confirmation**
   - User confirms the rename operation in dialog
   - `handleRuleBasedRenameConfirm` callback is executed (defined in [TvShowPanel.tsx](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\TvShowPanel.tsx))
   - Calls `startToRenameFiles()` from [useTvShowRenaming](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\hooks\useTvShowRenaming.ts) hook

5. **File Rename Execution**
   - [startToRenameFiles](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\hooks\useTvShowRenaming.ts) collects all files with `newPath` that differs from current `path`
   - Separates files into two categories:
     - `videoFilesToRename`: Files with type === "video"
     - `associatedFilesToRename`: Files with type !== "video" (subtitles, audio, nfo, poster, etc.)
   - Filters out files where from and to paths are identical
   - If no files need renaming, displays info toast and returns

6. **Video Files Rename (Backend — unified renameFiles API)**
   - Calls `renameBatch(filteredVideoFiles, mediaFolderPath)` which calls [renameFiles API](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\api\renameFiles.ts) with **`mediaFolder` included in the request body**
   - Converts paths to platform-specific format using `Path.toPlatformPath()`
   - **Backend Processing** ([handleRenameFiles](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\route\RenameFiles.ts)):
     - Receives POST request to `/api/renameFiles`
     - Extracts `files` array, optional `traceId`, **`mediaFolder`**, and **`clientId`** from request body
     - Calls [processRenameFiles](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\route\RenameFiles.ts) function
   - **Validation** ([validateRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesInBatch.ts)):
     - Returns `RenameValidationResult` with `isValid`, `errors[]`, and `validatedRenames[]`
     - Validates no abnormal paths (special characters, invalid paths)
     - Validates no duplicate source files
     - Validates no duplicate destination files
     - Validates no identical source and destination paths
     - Validates no chaining conflicts (destination of one rename cannot be source of another)
     - Validates source files exist
     - Validates destination files do not exist
     - Validates paths are within media folder
   - **Execution** ([executeBatchRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts)):
     - Iterates all validated rename operations via the shared batch function
     - For each operation: creates destination directory recursively, performs `fs.rename()`
     - Returns `{ success, successfulRenames, errors }`
   - **Metadata Update (in-process, same request)**:
     - If `mediaFolder` was provided in the request, immediately calls [updateMediaMetadataAndBroadcast](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts) with `successfulRenames`
     - Uses [updateMediaMetadataAfterRename](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesInBatch.ts) (batch version, always):
       - Creates a rename map for quick lookup
       - Updates all file paths in `files` array
       - Updates `mediaFiles` array with new absolute paths, subtitle paths, and audio paths
     - Writes updated metadata back to cache file
     - Broadcasts `mediaMetadataUpdated` event to all connected clients via Socket.IO
   - Returns `{ data: { succeeded, failed } }` response

7. **Associated Files Rename**
   - After video files are processed, renames associated files (subtitles, audio, nfo, poster, etc.)
   - Same unified backend process as video files (single `POST /api/renameFiles` call with `mediaFolder`):
     - Validation through `validateRenameOperations`
     - Execution through `executeBatchRenameOperations`
     - Metadata update + broadcast handled in-process by the same request
   - This sequential order ensures video files are renamed before associated files that depend on them

8. **Post-Rename Cleanup**
   - Backend has already updated metadata and broadcast `mediaMetadataUpdated` event
   - If any files were successfully renamed, calls `refreshMediaMetadata(mediaFolderPath)` to reload folder state (typically triggered by the Socket.IO event)
   - Displays result toast:
     - Success: "Successfully renamed X file(s) (Y video, Z associated)"
     - Partial success: "Renamed X file(s), Y failed"
     - Failure: "Failed to rename X file(s)"
   - Sets `setIsRenaming(false)` to clear renaming state

#### Key Components

**Frontend (UI)**:
- **[useTvShowRenaming](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\hooks\useTvShowRenaming.ts)**: Core hook handling file rename logic; uses shared `renameBatch()` helper for both video and associated file batches
- **[useTvShowFileNameGeneration](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\hooks\useTvShowFileNameGeneration.ts)**: Hook for generating preview file names
- **[tvShowPromptsStore](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\stores\tvShowPromptsStore.ts)**: State management for rename prompt dialog

**Backend (CLI)**:
- **[handleRenameFiles](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\route\RenameFiles.ts)**: HTTP route handler for `/api/renameFiles` endpoint; now handles rename + metadata update + broadcast in one request when `mediaFolder` is provided
- **[processRenameFiles](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\route\RenameFiles.ts)**: Orchestrates validation → batch execution → metadata update
- **[validateRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesInBatch.ts)**: Single validation entry point; returns `RenameValidationResult`
- **[executeBatchRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts)**: Unified batch execution function used by all rename paths
- **[updateMediaMetadataAndBroadcast](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts)**: Updates metadata cache and broadcasts change event; always uses batch version
- **[updateMediaMetadataAfterRename](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesInBatch.ts)**: Updates `files`, `mediaFiles.absolutePath`, `subtitleFilePaths`, and `audioFilePaths` for all renames
- **[getMediaFolder](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\getMediaFolder.ts)**: Returns the media folder a given file path belongs to

---

### Build-in AI Assistant

The Build-in AI Assistant allows users to rename TV show episodes through natural language conversation. It uses a three-step task-based approach.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Frontend (UI)                                  │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │   Chat UI    │───►│  Socket.IO    │                              │
│  │              │    │   Events      │                              │
│  └──────────────┘    └──────┬───────┘                              │
│       ▲                     │                                        │
│       │                     │                                        │
│       └─────────────────────┘                                        │
│               begin/addFile/end events                                 │
│                                                   │                │
│                                                   │ POST /api/chat │
│                                                   ▼                │
└───────────────────────────────────────────────────┼────────────────────┘
                                                    │
┌───────────────────────────────────────────────────┼────────────────────┐
│                      Backend (CLI)            │                     │
│                     ┌─────────▼────────┐       │                     │
│                     │  ChatTask      │◄──────┘                     │
│                     └────────┬────────┘                             │
│                              │                                      │
│                     ┌────────┼────────┐                            │
│                     ▼        ▼        ▼                            │
│            ┌─────────────┐  ┌──────────┐  ┌─────────────┐         │
│            │beginRename  │  │addRename  │  │endRename    │         │
│            │FilesTask    │  │FileToTask│  │FilesTask    │         │
│            └──────┬──────┘  └────┬─────┘  └──────┬──────┘         │
│                   │               │               │                    │
│                   ▼               ▼               ▼                    │
│            ┌─────────────────────────────────────┐                    │
│            │   renameFilesTool (in-memory)    │                    │
│            │   - cache: Record<string, Task>  │                    │
│            └─────────────────────────────────────┘                    │
│                   │               │               │                    │
│                   ▼               ▼               ▼                    │
│            ┌─────────────────────────────────────┐                    │
│            │   Socket.IO broadcast events        │                    │
│            │   - AskForRenameFilesConfirmation  │                    │
│            │     (begin, addFile, end)        │                    │
│            └─────────────────────────────────────┘                    │
│                                                   │                │
│                                                   │ broadcast       │
│                                                   ▼                │
└───────────────────────────────────────────────────┼────────────────────┘
                                                    │
                                                    │ begin/addFile/end
                                                    ▼
┌───────────────────────────────────────────────────┼────────────────────┐
│                       Frontend (UI)           │                     │
│                                                   │                │
│                                          Update UI Preview          │
│                                                   │                │
└───────────────────────────────────────────────────┴────────────────────┘
```

#### Flow Sequence

1. **User Chat Request**
   - User sends rename request through chat UI in [ChatTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\tasks\ChatTask.ts)
   - Request is sent to `/api/chat` endpoint with messages and `clientId`

2. **AI Processing**
   - [handleChatRequest](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\tasks\ChatTask.ts#L152-L158) processes the request
   - Creates AI provider based on user configuration
   - Converts UI messages to model messages format
   - Streams response using [streamText](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\tasks\ChatTask.ts#L71-L87) from AI SDK

3. **Tool Registration**
   - Three rename tools are registered with AI agent:
     - `beginRenameFilesTaskV2`: Creates new rename task
     - `addRenameFileToTaskV2`: Adds file to existing task
     - `endRenameFilesTaskV2`: Finalizes and executes task
   - Tools are created by [createBeginRenameFilesTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L20-L78), [createAddRenameFileToTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L80-L136), and [createEndRenameFilesTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L138-L369)

4. **Task Creation (beginRenameFilesTask)**
   - AI calls `beginRenameFilesTask` tool with `mediaFolderPath`
   - [beginRenameFilesTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTool.ts#L18-L38):
     - Generates unique task ID using `crypto.randomUUID()`
     - Creates task in in-memory cache with `mediaFolderPath` and empty `files` array
     - Broadcasts `AskForRenameFilesConfirmation.beginEvent` via Socket.IO
     - Frontend receives event and opens AI-based rename prompt dialog
   - Returns `taskId` to AI

5. **Adding Files to Task (addRenameFileToTask)**
   - AI calls `addRenameFileToTask` tool for each file to rename
   - [addRenameFileToTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTool.ts#L55-L75):
     - Validates task exists in cache
     - Adds `{ from, to }` pair to task's files array
     - Broadcasts `AskForRenameFilesConfirmation.addFileEvent` with file paths
     - Frontend receives event and updates preview display
   - Returns success to AI
   - AI continues adding files until all files are queued

6. **Task Finalization (endRenameFilesTask)**
   - AI calls `endRenameFilesTask` tool to execute the rename
   - [endRenameFilesTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L138-L369):
     - Retrieves task from cache
     - Validates media metadata exists for the folder
     - Validates all rename operations using [validateRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesInBatch.ts) (returns `RenameValidationResult`)
     - Broadcasts `AskForRenameFilesConfirmation.endEvent` to signal ready for confirmation
     - Waits for user confirmation via [acknowledge](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\socketIO.ts)
     - If user cancels, returns error
     - Executes batch rename using [executeBatchRenameOperations](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts)
     - Updates media metadata using [updateMediaMetadataAndBroadcast](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\utils\renameFileUtils.ts)
     - Removes task from cache
   - Returns success/failure to AI

7. **Frontend Updates**
   - Frontend receives Socket.IO events:
     - `beginEvent`: Opens rename preview dialog
     - `addFileEvent`: Updates preview with each file being renamed
     - `endEvent`: Shows confirmation button
   - After confirmation, receives `mediaMetadataUpdated` event and refreshes display

#### Key Components

**Frontend (UI)**:
- **Chat UI**: User interface for AI conversation
- **Socket.IO Client**: Receives real-time events from backend

**Backend (CLI)**:
- **[handleChatRequest](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\tasks\ChatTask.ts#L152-L158)**: HTTP route handler for `/api/chat` endpoint
- **[processChatRequest](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\tasks\ChatTask.ts#L28-L138)**: Processes chat requests and manages AI interactions
- **[createBeginRenameFilesTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L20-L78)**: Creates AI tool for starting rename task
- **[createAddRenameFileToTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L80-L136)**: Creates AI tool for adding files to task
- **[createEndRenameFilesTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTask.ts#L138-L369)**: Creates AI tool for finalizing and executing task; uses `validateRenameOperations` directly
- **[beginRenameFilesTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTool.ts#L18-L38)**: Creates new rename task in memory
- **[addRenameFileToTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTool.ts#L55-L75)**: Adds file to existing task
- **[endRenameFilesTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesTool.ts#L83-L98)**: Removes task from cache and broadcasts end event

---

### MCP Tool

The MCP (Model Context Protocol) tool allows external AI clients to rename TV show episodes through a standardized protocol. It uses a file-based task storage system.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    External MCP Client                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │begin-rename  │───►│add-rename   │───►│end-rename   │      │
│  │episode-video  │    │episode-video │    │episode-video │      │
│  │file-task     │    │file         │    │file-task    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                           ▲                                        │
│                           │ MCP Protocol (JSON-RPC)                 │
└───────────────────────────┼────────────────────────────────────────┘
                            │
                            │ MCP Tool Calls
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Backend (CLI) - MCP Layer                      │
│                     ┌─────────▼────────┐                           │
│                     │   MCP Server    │                           │
│                     └────────┬────────┘                           │
│                              │                                    │
│                     ┌────────┼────────┐                           │
│                     ▼        ▼        ▼                           │
│            ┌─────────────┐  ┌──────────┐  ┌─────────────┐         │
│            │handleBegin  │  │handleAdd  │  │handleEnd    │         │
│            │RenameTask   │  │RenameFile │  │RenameTask   │         │
│            └──────┬──────┘  └────┬─────┘  └──────┬──────┘         │
│                   │               │               │                    │
│                   ▼               ▼               ▼                    │
│            ┌─────────────────────────────────────┐                    │
│            │   renameFilesToolV2 (file-based)  │                    │
│            │   - plans/*.plan.json files      │                    │
│            │   - persistent task storage      │                    │
│            └─────────────────────────────────────┘                    │
│                   │               │               │                    │
│                   ▼               ▼               ▼                    │
│            ┌─────────────────────────────────────┐                    │
│            │   Socket.IO broadcast event       │                    │
│            │   - RenameFilesPlanReady        │                    │
│            └─────────────────────────────────────┘                    │
│                                                   │                │
│                                                   │ broadcast       │
│                                                   ▼                │
┌───────────────────────────────────────────────────┼────────────────────┐
│                       Frontend (UI)           │                     │
│                                                   │                │
│                                          RenameFilesPlanReady    │
│                                          → UI Confirmation      │
│                                          → executeRenamePlan()  │
│                                          → POST /api/renameFiles│
│                                            (with mediaFolder)   │
│                                                   │                │
└───────────────────────────────────────────────────┴────────────────────┘
```

#### Flow Sequence

1. **MCP Tool Registration**
   - MCP server registers three rename tools in [registerBeginRenameTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L251-L269), [registerAddRenameFileTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L271-L289), and [registerEndRenameTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L291-L309)
   - Tool names:
     - `begin-rename-episode-video-file-task`
     - `add-rename-episode-video-file`
     - `end-rename-episode-video-file-task`

2. **Task Creation (begin-rename-episode-video-file-task)**
   - External MCP client calls tool with `mediaFolderPath`
   - [handleBeginRenameTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L57-L83):
     - Validates `mediaFolderPath` parameter
     - Converts path to POSIX format
     - Calls [beginRenameFilesTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L51-L68):
       - Generates unique `taskId` and `planId`
       - Creates plan file in `plans/` directory with structure:
         ```json
         {
           "id": "planId",
           "task": "rename-files",
           "status": "pending",
           "mediaFolderPath": "path/to/folder",
           "files": []
         }
         ```
     - Returns `taskId` to MCP client

3. **Adding Files to Task (add-rename-episode-video-file)**
   - MCP client calls tool with `taskId`, `from`, and `to` parameters
   - [handleAddRenameEpisodeVideoFile](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L113-L184):
     - Validates all parameters (type checks + video extension check)
     - Calls [addRenameFileToTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L70-L92):
       - Reads plan file from disk
       - Validates that `from` file is an episode video file in media metadata
       - Adds `{ from, to }` pair to plan's files array
       - Writes updated plan back to disk
     - Returns success to MCP client
   - MCP client continues adding files until all are queued

4. **Task Finalization (end-rename-episode-video-file-task)**
   - MCP client calls tool with `taskId`
   - [handleEndRenameTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L210-L249):
     - Validates task exists and has files
     - Calls [endRenameFilesTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L102-L117):
       - Reads plan file from disk
       - Broadcasts `RenameFilesPlanReady` event with:
         ```json
         {
           "taskId": "taskId",
           "planFilePath": "path/to/plan.plan.json"
         }
         ```
   - Frontend receives `RenameFilesPlanReady` event and shows confirmation dialog

5. **User Confirmation and Execution**
   - Frontend displays rename plan preview with all files to be renamed
   - User confirms or rejects the plan
   - On confirmation, frontend calls [executeRenamePlan](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\TvShowPanelUtils.ts) which:
     - Collects `{ from, to }` pairs from the plan's seasons model
     - Calls `POST /api/renameFiles` **with `mediaFolder`** — backend handles rename + metadata update + broadcast in one request
     - Displays success/failure toast
     - Calls `updatePlan(plan.id, "completed")` and `fetchPendingPlans()`
   - Plan status is updated to `completed` or `rejected` via [updateRenamePlanStatus](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L119-L163)

6. **Frontend Updates**
   - Frontend receives `RenameFilesPlanReady` event
   - Opens confirmation dialog showing all rename operations
   - After confirmation, executes rename using `executeRenamePlan` (unified with UI rename flow)
   - Backend broadcasts `mediaMetadataUpdated` event after successful rename; UI refreshes display

#### Key Components

**MCP Client (External)**:
- MCP-compatible AI clients that can call SMM tools

**Backend (CLI)**:
- **[registerBeginRenameTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L251-L269)**: Registers MCP tool for starting rename task
- **[registerAddRenameFileTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L271-L289)**: Registers MCP tool for adding files to task
- **[registerEndRenameTaskTool](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L291-L309)**: Registers MCP tool for finalizing task
- **[handleBeginRenameTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L57-L83)**: Handles MCP tool call for starting task
- **[handleAddRenameEpisodeVideoFile](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L113-L184)**: Handles MCP tool call for adding files
- **[handleEndRenameTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\mcp\tools\beginRenameTaskTool.ts#L210-L249)**: Handles MCP tool call for finalizing task
- **[beginRenameFilesTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L51-L68)**: Creates new rename task in plans directory
- **[addRenameFileToTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L70-L92)**: Adds file to existing task plan
- **[endRenameFilesTaskV2](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L102-L117)**: Finalizes task and broadcasts plan ready event
- **[updateRenamePlanStatus](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L119-L163)**: Updates plan status to completed or rejected
- **[getRenameTask](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L94-L100)**: Retrieves task from plan file
- **[getAllPendingRenamePlans](file:///c:\Users\lawrence\workspace\smm_github\apps\cli\src\tools\renameFilesToolV2.ts#L227-L288)**: Returns all pending rename plans from plans directory

**Frontend (UI)**:
- **[executeRenamePlan](file:///c:\Users\lawrence\workspace\smm_github\apps\ui\src\components\TvShowPanelUtils.ts)**: Executes a rename plan using the unified `POST /api/renameFiles` (with `mediaFolder`); shared execution path with UI Rule-Based rename

---

### Shared Backend Infrastructure

All three rename paths share the same backend infrastructure after refactoring:

| Component | File | Role |
|-----------|------|------|
| `validateRenameOperations` | `apps/cli/src/tools/renameFilesInBatch.ts` | Single validation entry point; returns `RenameValidationResult` |
| `executeBatchRenameOperations` | `apps/cli/src/utils/renameFileUtils.ts` | Single batch execution function |
| `updateMediaMetadataAndBroadcast` | `apps/cli/src/utils/renameFileUtils.ts` | Single metadata update + broadcast function |
| `updateMediaMetadataAfterRename` | `apps/cli/src/tools/renameFilesInBatch.ts` | Batch metadata update (handles `files`, `mediaFiles`, `subtitleFilePaths`, `audioFilePaths`) |
| `getMediaFolder` | `apps/cli/src/utils/getMediaFolder.ts` | Returns the media folder a file path belongs to |

### Comparison of Rename Methods

| Aspect | UI RuleBased | AI Assistant | MCP Tool |
|---------|--------------|--------------|------------|
| **User Interface** | UI buttons and dialogs | Chat conversation | External MCP client |
| **Task Storage** | N/A (immediate execution) | In-memory cache | File-based (plans/*.plan.json) |
| **Validation** | Backend only (`validateRenameOperations`) | Backend only (`validateRenameOperations`) | Backend only (`validateRenameOperations`) |
| **Confirmation** | UI dialog | UI dialog via Socket.IO | UI dialog via Socket.IO |
| **Execution** | `executeBatchRenameOperations` via `/api/renameFiles` | `executeBatchRenameOperations` directly | `executeBatchRenameOperations` via `/api/renameFiles` |
| **Metadata Update** | In-process in `/api/renameFiles` (with `mediaFolder`) | `updateMediaMetadataAndBroadcast` directly | In-process in `/api/renameFiles` (with `mediaFolder`) |
| **Persistence** | N/A | Lost on restart | Persisted to disk |
| **Real-time Updates** | Yes (Socket.IO broadcast) | Yes (Socket.IO broadcast) | Yes (Socket.IO broadcast) |
| **Use Case** | Manual batch renaming with rules | AI-assisted renaming | External AI integration |
