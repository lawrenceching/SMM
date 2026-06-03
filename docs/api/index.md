# API 列表

## CommandLog
Source Code: apps/cli/src/route/commandLog.ts
HTTP: `GET /api/command-log/:executionId` — reads `commands/<uuid>/main.log` under the app log root; query `format` (`raw` \| `segments`), optional byte `offset` and `limit` (capped). Response headers `X-Log-Total-Bytes`, `X-Log-Truncated`, `X-Log-Read-Offset`, `X-Log-Read-Limit`.

## CommandExecutionStatus
Source Code: apps/cli/src/route/commandExecutionStatus.ts
HTTP: `GET /api/command-execution/:executionId` — returns `phase` (`unknown` \| `running` \| `finished`), optional `outcome` (`success` \| `failure`), `exitCode`, `signal`, `systemNote`. Correlates with `X-Command-Execution-Id` from `POST /api/executeCmd`. UI main thread polls this to reconcile IndexedDB when Service Worker is suspended.

## MoveFileToTrash
Source Code: apps/cli/src/route/MoveFileToTrash.ts
HTTP: `POST /api/moveFileToTrash` — moves a file to the system trash/recycle bin on desktop environments (permanent delete on headless/server). Request body: `{ path: string }` (platform absolute path).

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

## McpStart
Source Code: apps/cli/src/route/Mcp.ts
HTTP: `PUT /api/mcp/start` — starts the MCP server on the configured host:port. Optional request body: `{ host?: string, port?: number }`. Returns `McpServerState` JSON (`{ status: 'running' | 'stopped' | 'error', host?, port?, error? }`).

## McpStop
Source Code: apps/cli/src/route/Mcp.ts
HTTP: `PUT /api/mcp/stop` — stops the MCP server gracefully. No request body. Returns `McpServerState` JSON.

## McpStatus
Source Code: apps/cli/src/route/Mcp.ts
HTTP: `GET /api/mcp/status` — returns the current MCP server runtime state as `McpServerState` JSON.
