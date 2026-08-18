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

## DeleteFolder
Source Code: packages/core-routes/src/deleteFolder.ts
HTTP: `POST /api/deleteFolder` — permanently deletes a managed directory (recursive). Request body: `{ path: string }` (platform absolute path). The path must be inside the same server-side allowlist as `deleteFile` (`validatePathIsInAllowlist` + `buildAllowlist()` — covers `userDataDir`, `appDataDir`, `tmpDir`, and configured media folders; thus `{appDataDir}/metadata`, `{appDataDir}/plans`, and media folders are allowed). Rejects when the path exists but is a file (`Path Is File`). ENOENT (folder already absent) is treated as idempotent success.

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (same ports as DeleteFile). The Hono shell at `apps/cli/src/route/DeleteFolder.ts` delegates to `doDeleteFolder` from `@smm/core-routes`.

## DeleteMediaMetadata (REMOVED)
The `POST /api/deleteMediaMetadata` route was removed in favor of the unified `/api/deleteFile` API. The UI now computes the metadata cache file path (`metadataCacheFilePath(appDataDir, folderPath)`) and calls `/api/deleteFile` directly. The MCP `deleteMediaMetadata` tool continues to work in-process and is not affected.

## Plans (GetPlans / CreatePlan / UpdatePlan)
Source Code: packages/core-routes/src/plansApi.ts (handlers), packages/core-routes/src/routes/plansRoute.ts (Node http routes), packages/core-routes/src/tools/plans.ts (file store). apps/cli thin wrapper: apps/cli/src/route/Plans.ts (registered in apps/cli/server.ts via `handlePlans`).

Unified, platform-agnostic CRUD for recognize / rename **plans**, replacing the removed `POST /api/getPendingPlans` and the old per-status `POST /api/updatePlan` route. Plans are persisted as `appDataDir/plans/*.plan.json`. The UI consumes these via TanStack Query (`usePlansQuery`, `useCreatePlanMutation`, `useUpdatePlanMutation` in `apps/ui/src/hooks/plans`) instead of the removed Zustand `plansStore` / IndexedDB. A `PlanReady` Socket.IO event triggers `['plans']` query invalidation.

- `POST /api/getPlans` — active (non-terminal) plans for a media folder. Request body: `{ mediaFolderPath: string }`. Response: `{ data: { plans: AnyPlan[] } }` or `{ error }`.
- `POST /api/createPlan` — create a plan in `preparing` status. Request body: `{ id?: string, task: "recognize-media-file" | "rename-files", mediaFolderPath: string, creator: "app" | "ai" }`. Response: `{ data: { plan: AnyPlan } }` or `{ error }`.
- `POST /api/updatePlan` — patch a plan's content. Request body: `{ id: string, status?: "preparing" | "pending" | "completed" | "rejected", files?: RecognizedFile[] | RenameEntry[] }`. Terminal statuses (`completed` / `rejected`) delete the plan file. Response: `{ data: { plan: AnyPlan } }` or `{ error }` (e.g. plan not found).

Each plan carries a `creator` field (`"app"` for rule-based UI plans, `"ai"` for AI Assistant / MCP plans) and a `status` lifecycle of `preparing → pending → completed | rejected`.

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (port from `HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI, 18081 on HarmonyOS). All require `appDataDir` to be configured; return `Error Reason: appDataDir is not configured` otherwise.

## Shutdown
Source Code: apps/cli/src/route/shutdown.ts
HTTP: `POST /api/shutdown` — localhost-only graceful shutdown used by the Electron main process. Runs yt-dlp cookies temp cleanup, stops the CLI server, then exits the process. Response: `{ ok: true }`. Non-loopback callers receive 403.

CLI also sweeps `{userDataDir}/temp/ytdlp-cookies-*.txt` on startup (fallback when the prior run was hard-killed).

## GetFolders
Source Code: apps/cli/src/route/GetFolders.ts
HTTP: `POST /api/get-folders` — returns imported media folder paths via Layer 2 `Core.getFolders()` (reads `userDataDir/smm.json`). Request body: `{}` (optional). Response: `{ data: { folders: string[] } }` or `{ error }`. Used by UI `useFoldersQuery` when `localStorage["smm.v3.enabled"] === "true"`. CLI equivalent: `smm list`.

## ImportFolder
Source Code: apps/cli/src/route/ImportFolder.ts
HTTP: `POST /api/import-folder` — starts Layer 2 `Core.importFolder(path, type, { skipInit? })`. Request body: `{ path: string, type: "tvshow" | "movie" | "music" | "anime", skipInit?: boolean }` (`anime` aliases `tvshow`). Response: `{ data: { id } }` (job id) or `{ error }`. Does not wait for the pipeline; poll `POST /api/get-job`. CLI equivalent: `smm add`.

## GetJob
Source Code: apps/cli/src/route/GetJob.ts
HTTP: `POST /api/get-job` — returns an in-memory import job from `Core.getJob(id)`. Request body: `{ id: string }`. Response: `{ data: ImportJob }` or `{ error }` (`Job not found`). CLI `smm add` polls this internally until the job settles.

## ShowFolder
Source Code: apps/cli/src/route/ShowFolder.ts
HTTP: `POST /api/show-folder` — UI-aligned folder snapshot via the same helper as `smm show`. Request body: `{ path: string }`. Response: `{ data: { path, status, type?, title? } }` (`status`: `ok` | `folder_not_found` | `error_loading_metadata`) or `{ error }` (not imported / path missing).

## FolderMetadata
Source Code: apps/cli/src/route/FolderMetadata.ts
HTTP: `POST /api/folder-metadata` — MediaMetadata for an imported folder via `Core.getMediaMetadata`, with `files` omitted (same fields as `smm metadata`). Request body: `{ path: string }`. Response: `{ data: MediaMetadata }` or `{ error }` (not imported / no cache).

## UnimportFolder
Source Code: apps/cli/src/route/UnimportFolder.ts
HTTP: `POST /api/unimport-folder` — removes an imported media folder from `userDataDir/smm.json` and deletes its metadata cache via Layer 2 `Core.unimportFolder(path)`. Request body: `{ path: string }`. Response: `{ data: { path } }` or `{ error }`. Idempotent when the path is not in the config. Used by UI delete (context menu, Delete key, multi-select) when `localStorage["smm.v3.enabled"] === "true"`. CLI equivalent: `smm rm`.

## SetWatchedFolder
Source Code: apps/cli/src/route/SetWatchedFolder.ts
HTTP: `POST /api/setWatchedFolder` — sets the single media folder the CLI `FolderWatcher` listens to (UI primary `selectedFolder`). Request body: `{ folderPath: string | null }` (platform absolute path, or null/empty to stop watching). Response: `{ data: { watchedFolder: string | null }, error?: string }`. Startup no longer watches all imported folders.

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
Source Code: packages/core-routes/src/routes/mcpLifecycleRoute.ts (apps/cli: apps/cli/src/route/Mcp.ts thin wrapper)
HTTP: `PUT /api/mcp/start` — starts the MCP server. Optional request body: `{ host?: string, port?: number }`. Returns `McpServerState` JSON (`{ status: 'running' | 'stopped' | 'error', host?, port?, url?, error? }`). On desktop CLI, MCP listens on `mcpPort` (default 30001). On OHOS, MCP is gated at `url` on the main HTTP port (e.g. `http://127.0.0.1:18081/mcp`); `mcpPort` is not used for listening.

## McpStop
Source Code: packages/core-routes/src/routes/mcpLifecycleRoute.ts
HTTP: `PUT /api/mcp/stop` — stops the MCP server gracefully. No request body. Returns `McpServerState` JSON.

## McpStatus
Source Code: packages/core-routes/src/routes/mcpLifecycleRoute.ts
HTTP: `GET /api/mcp/status` — returns the current MCP server runtime state as `McpServerState` JSON. Prefer `url` for the client connection address when present.

## Discover
Source Code: apps/cli/src/route/discover.ts
HTTP: `GET /api/discover` — fetches the remote discovery config from `https://lawrenceching.github.io/SMM/config.json` (overridable via `EXTERNAL_CONFIG_FILE_URL`) and returns normalized `mediaDatabases` and `reverseProxies` arrays plus optional `latestVersion`. Each media-database entry has the shape `{ type: 'tmdb' | 'tvdb' | 'tmdb-asset' | 'tvdb-asset', url: string, authorizationMethod: 'date-token' | 'none' }`. Each reverse-proxy entry has the shape `{ id: string, type: 'general', url: string, authorizationMethod: 'date-token' | 'none' }` (the remote config's `authMethod` is normalized to `authorizationMethod`). `latestVersion` is a non-empty string from the remote `config.json` when present. The CLI never returns an error response — fetch failures (timeout, non-2xx, malformed body) result in empty lists (and no `latestVersion`). The UI uses this endpoint at startup to populate candidate TMDB/TVDB endpoints and for StatusBar new-version checks.

## DownloadImage
Source Code: packages/core-routes/src/downloadImage.ts
HTTP: `GET /api/image?url=<encoded url>` — downloads an image (HTTP / `file://` / protocol-relative `//`) and streams it back as binary with the upstream `Content-Type` (defaulting to `image/jpeg` when missing). The `file://` branch validates the resolved platform path against the server-side allowlist. Used by the UI's `useImage` hook (`apps/ui/src/hooks/useImage.ts`) and the "Edit Tags" dialog screenshot preview (`apps/ui/src/components/dialogs/media-file-property-dialog.tsx`).

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (port from `HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI, 18081 on HarmonyOS). The Hono shell at `apps/cli/src/route/DownloadImage.ts` delegates to `doDownloadImage` from `@smm/core-routes`.

## DownloadImageAsFile
Source Code: packages/core-routes/src/downloadImageAsFile.ts
HTTP: `POST /api/downloadImage` — downloads an image to a managed file path. Request body: `{ url: string, path: string }` (path in platform-specific format). If the destination file already exists, the response `error` is set to `existedFileError(path)` and the file is left untouched. The path must be inside the server-side allowlist (built by `apps/cli/src/utils/buildAllowlist.ts`). Used by the UI to save poster / fanart / still images scraped from TMDB and TVDB (`useDownloadThumbnailFromTMDB`, `useDownloadThumbnailFromTVDB`, `useScrapePosterMutation`, `useScrapeFanartMutation`, `lib/utils.ts`).

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (port from `HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI, 18081 on HarmonyOS). Both entry points use the shared `handleDownloadImageAsFilePost` from `@smm/core-routes`; on the desktop CLI the Hono route is an in-process bridge to that handler. The allowlist is re-resolved on every request via `resolveAllowlist`, so folders imported after server startup are honored without a restart.

## ReadImage
Source Code: packages/core-routes/src/readImage.ts
Document: docs/api/ReadImageAPI.md

HTTP: `POST /api/readImage` — reads a local image file and returns it as a `data:image/<mime>;base64,…` URL. Request body: `{ path: string }` (platform absolute path). The path must be inside the server-side allowlist and have a supported extension (`.jpg .jpeg .png .gif .webp .svg .bmp .ico .tiff .tif`). Missing files return `File Not Found`; out-of-allowlist paths return `Path "<path>" is not in the allowlist`.

Served by both the Hono Bun server (apps/cli port 30000) and the core-routes Node `http` server (port from `HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI, 18081 on HarmonyOS). The Hono shell at `apps/cli/src/route/ReadImage.ts` delegates to `doReadImage` from `@smm/core-routes`.
