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

## DeleteFile
Source Code: packages/core-routes/src/deleteFile.ts
HTTP: `POST /api/deleteFile` — permanently deletes a managed file. Request body: `{ path: string }` (platform absolute path). The path must be inside the server-side allowlist (built by `apps/cli/src/utils/buildAllowlist.ts` — covers `userDataDir`, `appDataDir`, `tmpDir`, and configured media folders). ENOENT (file already absent) is treated as idempotent success. The UI uses this API to remove managed yt-dlp cookies temp files (`{userDataDir}/temp/ytdlp-cookies-*.txt`) and media metadata cache files (`{appDataDir}/metadata/{sanitized-folder}.json`).

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (port from `HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI, 18081 on HarmonyOS). The Hono shell at `apps/cli/src/route/DeleteFile.ts` delegates to `doDeleteFile` from `@smm/core-routes`.

## DeleteMediaMetadata (REMOVED)
The `POST /api/deleteMediaMetadata` route was removed in favor of the unified `/api/deleteFile` API. The UI now computes the metadata cache file path (`metadataCacheFilePath(appDataDir, folderPath)`) and calls `/api/deleteFile` directly. The MCP `deleteMediaMetadata` tool continues to work in-process and is not affected.

## Shutdown
Source Code: apps/cli/src/route/shutdown.ts
HTTP: `POST /api/shutdown` — localhost-only graceful shutdown used by the Electron main process. Runs yt-dlp cookies temp cleanup, stops the CLI server, then exits the process. Response: `{ ok: true }`. Non-loopback callers receive 403.

CLI also sweeps `{userDataDir}/temp/ytdlp-cookies-*.txt` on startup (fallback when the prior run was hard-killed).

## isFolderAvailable
Source Code: packages/core-routes/src/isFolderAvailable.ts
Document: docs/api/IsFolderAvailableAPI.md

Served by both the Hono Bun server (apps/cli port 30000) and the
core-routes Node `http` server (port from
`HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI,
18081 on HarmonyOS). The UI calls the Hono server via the relative
URL `/api/isFolderAvailable`.

## ReadFile
Source Code: packages/core-routes/src/readFile.ts
Document: docs/api/ReadFileAPI.md

Served by both the Hono Bun server (apps/cli port 30000) and the
core-routes Node `http` server (port from
`HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI,
18081 on HarmonyOS). The UI calls the Hono server via the relative
URL `/api/readFile`. The Hono shell at `apps/cli/src/route/ReadFile.ts`
delegates to `doReadFile` from `@smm/core-routes`.

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

## Discover
Source Code: apps/cli/src/route/discover.ts
HTTP: `GET /api/discover` — fetches the remote media-database discovery config from `https://gitcode.com/lawrenceching/simple-media-manager/raw/main/assets/config.json` and returns the normalized `mediaDatabases` array. Each entry has the shape `{ type: 'tmdb' | 'tvdb', url: string, authorizationMethod: 'date-token' | 'none' }`. The CLI never returns an error response — fetch failures (timeout, non-2xx, malformed body) result in an empty list. The UI uses this endpoint at startup to populate the list of candidate TMDB/TVDB endpoints for reachability testing.
