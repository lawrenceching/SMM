# Change: Add AI-Driven Media File Recognition Tools

## Why

AI agents need the ability to recognize and organize media files systematically. Currently, AI agents can interact with media files individually, but there's no structured way for them to create a recognition plan that can be reviewed and approved by users before execution. This feature enables AI agents to:

1. Begin a recognition task for a media folder
2. Collect recognized files with their season/episode information
3. Present the complete plan to the user for review via the UI

This follows a similar pattern to the existing rename files task workflow, but focuses on media file recognition rather than renaming.

## What Changes

- Add three new AI tools: `beginRecognizeTask`, `addRecognizedMediaFile`, and `endRecognizeTask`
- Implement file-based task storage using `{taskId}.plan.json` in `${userDataDir}/plans/` directory
- Add Socket.IO event notification when recognition plan is ready for review
- Register the new tools in `ChatTask.ts` for AI agent access
- Create core recognition task utilities similar to `renameFilesTool.ts`

## Impact

- Affected specs: New `ai-tools` capability for media recognition
- Affected code:
  - `cli/src/tools/` - New recognition task tool files
  - `cli/tasks/ChatTask.ts` - Register new tools
  - `cli/src/utils/socketIO.ts` - Use broadcast for notifications
  - `core/types/RecognizeMediaFilePlan.ts` - Plan format (already exists)
  - UI components - Will need to handle recognition plan review (future work, not in this proposal)
