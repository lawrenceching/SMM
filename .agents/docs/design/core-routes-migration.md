# Core Routes Migration

将通用 HTTP 接口从 `apps/cli` 迁移到 `packages/core-routes`，基于 Node.js 原生 `node:http` 提供路由 handler。使 HarmonyOS 可复用同一套接口。

## 1. Design & Architecture

### 1.1 Motivation

所有 HTTP API 原实现在 `apps/cli` 内（Hono + Bun.serve），HarmonyOS 无法复用。`packages/core-routes` 提供与框架无关的路由实现。

### 1.2 Architecture

```
packages/core-routes/
├── src/
│   ├── doHello.ts              # hello 业务逻辑
│   ├── doWriteFile.ts          # writeFile 业务逻辑
│   ├── doReadFile.ts           # readFile 业务逻辑
│   ├── doListFiles.ts          # listFiles 业务逻辑
│   ├── doDeleteFile.ts         # deleteFile 业务逻辑
│   ├── doRenameFiles.ts        # renameFiles 业务逻辑
│   ├── doIsFolderAvailable.ts  # isFolderAvailable 业务逻辑
│   ├── doDownloadImage.ts      # downloadImage 业务逻辑
│   ├── doReadImage.ts          # readImage 业务逻辑
│   ├── register.ts             # 一次性注册全部路由
│   ├── reverseProxy.ts         # reverse proxy 核心
│   └── SocketIOManager.ts      # Socket.IO 管理
```

每个 `doXxx` 是纯函数（无框架依赖），配套 `handleXxx(req, res)` Node http handler。`apps/cli` 保留 Hono thin shell 调用 `doXxx`，`apps/ohos` 通过 `coreRouteHandlers` 直接使用。

### 1.3 Pattern

```
packages/core-routes: doXxx(config, input) → result  (pure function)
packages/core-routes: handleXxx(req, res)             (node:http handler)

apps/cli: Hono route → calls doXxx()                  (thin adapter)
apps/ohos: http.createServer → coreRouteHandlers      (direct)
```

## 2. Migrated APIs

| API | Status | Note |
|-----|--------|------|
| `POST /api/hello` | ✅ Migrated | Application bootstrap handshake |
| `POST /api/writeFile` | ✅ Migrated | First API migrated (pilot) |
| `POST /api/readFile` | ✅ Migrated | Bun.file() → Node fs |
| `POST /api/listFiles` | ✅ Migrated | — |
| `POST /api/deleteFile` | ✅ Migrated | Also deprecated `/api/deleteMediaMetadata` |
| `POST /api/renameFiles` | ✅ Migrated | Fixed ohos 404 |
| `POST /api/isFolderAvailable` | ✅ Migrated | Hono shell later restored for UI transparency |
| `GET /api/image` / `POST /api/downloadImage` / `POST /api/readImage` | ✅ Migrated | Bun.file() → Node http/fetch |

## 3. Key Design Decisions

### 3.1 Hono Shell Retention

除了 `isFolderAvailable` 曾尝试让 UI 直连 core-routes 端口（后来回退），所有 API 的 Hono shell 均保留。UI 不感知 `coreRoutesPort`。

### 3.2 deleteMediaMetadata Deprecation

`POST /api/deleteMediaMetadata` 被废弃，UI 端改为自行计算 metadata cache file path + 调用通用的 `deleteFile` API。

### 3.3 Image APIs

`DownloadImage`、`ReadImage` 原用 `Bun.file()`，迁移到 `node:http` + `fetch`，支持 streaming binary 和 base64 data URL。

### 3.4 Socket.IO

Socket.IO 管理从 `apps/cli` 上移到 `packages/core-routes`，通过 `createSocketIOManager(httpServer, config)` 附加到任意 `node:http.Server`。
