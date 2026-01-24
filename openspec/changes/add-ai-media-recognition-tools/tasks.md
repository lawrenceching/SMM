## 1. Implementation

- [x] 1.1 Create `cli/src/tools/recognizeMediaFilesTool.ts` with core utilities:
  - [x] `beginRecognizeTask(mediaFolderPath: string): string` - Generate UUID, create plan file in `${userDataDir}/plans/`, return task ID
  - [x] `addRecognizedMediaFile(taskId: string, file: RecognizedFile): void` - Add file to plan
  - [x] `endRecognizeTask(taskId: string): void` - Broadcast Socket.IO event
  - [x] `getTask(taskId: string): RecognizeMediaFilePlan | undefined` - Get task for validation
  - [x] Ensure plans directory is created if it doesn't exist
- [x] 1.2 Create `cli/src/tools/recognizeMediaFilesTask.ts` with AI tool wrappers:
  - [x] `createBeginRecognizeTaskTool(clientId, abortSignal)` - AI tool for beginning task
  - [x] `createAddRecognizedMediaFileTool(clientId, abortSignal)` - AI tool for adding files
  - [x] `createEndRecognizeTaskTool(clientId, abortSignal)` - AI tool for ending task
- [x] 1.3 Export new tools from `cli/src/tools/index.ts`
- [x] 1.4 Register tools in `cli/tasks/ChatTask.ts`:
  - [x] Import the three new tool creators
  - [x] Add them to the tools object in `streamText` call
- [x] 1.5 Create Socket.IO event type in `core/event-types.ts` for recognition plan ready notification
- [x] 1.6 Write unit tests for recognition task utilities
- [x] 1.7 Write unit tests for AI tool wrappers
