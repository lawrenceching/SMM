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

Whitelisted commands: `ffmpeg`, `ffprobe`, `yt-dlp`, `videocaptioner`. The UI builds CLI args client-side (`packages/core/whitelistedCmd`, `apps/ui/src/lib/whitelistedCmd`) and invokes tools through this endpoint. Optional headers: `X-Timeout`, `X-Command-Execution-Id` (UUID v4 for log correlation).

## TencentAsrTranscribe
Source Code: apps/cli/src/route/tencentAsr/Transcribe.ts
HTTP: `POST /api/tencent-asr/transcribe`
