# API 列表

## isFolderAvailable
Source Code: apps/cli/src/route/IsFolderAvailable.ts
Document: docs/api/IsFolderAvailableAPI.md

## ExecuteCmd
Source Code: apps/cli/src/route/executeCmd.ts
Document: docs/api/ExecuteCmdAPI.md

## VideoCaptionerTranscribe
Source Code: apps/cli/src/route/videocaptioner/Transcribe.ts
HTTP: `POST /api/videocaptioner/transcribe` — request body validated with Zod (`mediaPath`, optional `asr`, `language`, `wordTimestamps`, `format`).

## VideoCaptionerTranslate
Source Code: apps/cli/src/route/videocaptioner/Translate.ts
HTTP: `POST /api/videocaptioner/translate` — request body validated with Zod (`subtitlePath`, `translator`, `targetLanguage`, optional `reflect`, `layout`, `llm`).