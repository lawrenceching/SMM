# API 列表

## CommandLog
Source Code: apps/cli/src/route/commandLog.ts
HTTP: `GET /api/command-log/:executionId` — reads `commands/<uuid>/main.log` under the app log root; query `format` (`raw` \| `segments`), optional byte `offset` and `limit` (capped). Response headers `X-Log-Total-Bytes`, `X-Log-Truncated`, `X-Log-Read-Offset`, `X-Log-Read-Limit`.

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

## VideoCaptionerSynthesize
Source Code: apps/cli/src/route/videocaptioner/Synthesize.ts
HTTP: `POST /api/videocaptioner/synthesize` — request body validated with Zod (`videoPath`, `subtitlePath`, optional `subtitleMode`, `quality`, `style`, `renderMode`, `layout`).

## VideoCaptionerProcess
Source Code: apps/cli/src/route/videocaptioner/Process.ts
HTTP: `POST /api/videocaptioner/process` — request body validated with Zod (`mediaPath`, optional transcribe fields `asr` / `language` / `wordTimestamps` / `format`, optional subtitle leg `noOptimize` / `noSplit` / `noTranslate` / `translator` / `targetLanguage` / `reflect` / `layout` / `prompt` / `llm`, optional `noSynthesize`, optional synthesize fields `subtitleMode` / `quality` / `style` / `renderMode` / `synthesizeLayout`).
