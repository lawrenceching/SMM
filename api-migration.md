# apps/cli HTTP API → packages/core-routes 迁移分析

> 评估范围：`apps/cli/src/route/**` 下的所有 Hono route handler。
> 评估目标：判断哪些 API 适合下沉到 `@smm/core-routes`，被 `apps/cli` 与 `apps/ohos`（Electron 主进程）共用。

## 1. core-routes 的设计约束

回顾 `packages/core-routes/src/` 现有实现，沉淀到该包内的 route 必须满足：

| 约束 | 现有参考 | 说明 |
|------|---------|------|
| **框架中立** | `src/http.ts`、`src/routes/*.ts` 全部使用 `node:http` 的 `IncomingMessage` / `ServerResponse` | 不允许依赖 Hono（`apps/cli` 独有的 web 框架） |
| **运行时中立** | `src/listFiles.ts` 用 `node:fs/promises`，**不**用 `Bun.file` / `Bun.write` / `Bun.$` | `apps/ohos` 走 Electron + Node，CJS 打包后 Bun 全局不可用 |
| **零 apps/cli 业务依赖** | `isFolderAvailable` / `listFiles` / `writeFile` 仅依赖 `@smm/core` 和 `zod` | 不允许 `import '@/utils/...'`, `'../../lib/logger'`, `'../tools/...'`, `'../utils/...'` 等 |
| **配置驱动** | `CoreRoutesConfig = { allowlist, logger?, hello? }` | 平台特定路径（userDataDir / logDir / tmpDir）通过 `config` 注入；logger 走 `ctx.config.logger` |
| **无副作用 / 单进程可重入** | `createCommandExecutionLogWriter` 等有副作用的状态全部留在 `apps/cli` | core-routes 不持有 socket/MCP server 生命周期、pty 实例、shelljs 进程等 |
| **可独立单元测试** | `*.test.ts` 全部 vitest 跑在 Node 环境下 | 不得依赖 bun-only 的 `bun:test` / `bun --watch` |

构建链路参考：

```
packages/core-routes
  ├── src/index.ts         ← ESM
  ├── dist/core-routes.cjs ← apps/ohos/electron 在 CJS 环境 require
  └── tsconfig  lib: ESNext, target: ESNext, noEmit
```

`apps/ohos` 的 `main.js`（Electron 主进程）目前只调用 `createCoreRoutesRequestHandler`，并自行提供 `allowlist`（`userData` / `temp` / `homedir`）和 `hello` 配置。也就是说，能放进 core-routes 的 API 一定能被 `ohos/electron` 与 `cli` 同时复用。

---

## 2. apps/cli route 清单与迁移评估

> 路径均以 `apps/cli/src/route/` 为根。`✅` 可迁移；`⚠️` 需要重构/拆分后迁移；`❌` 不建议迁移。

### 2.1 已经迁移到 core-routes

| apps/cli route | 现状 | core-routes 对应 |
|------|------|---------|
| `ListFiles.ts` | 薄壳，调用 `doListFiles` from `@smm/core-routes` | ✅ 已在 `routes/listFilesRoute.ts` |
| `WriteFile.ts` | 薄壳，调用 `doWriteFile` from `@smm/core-routes` | ✅ 已在 `routes/writeFileRoute.ts` |
| `IsFolderAvailable.ts` | 文件已删除，仅在 test 文件残留 `*.test.ts` | ✅ 已在 `routes/isFolderAvailableRoute.ts` |
| `execute.ts → POST /api/hello` | 调用 `doHello` from `@smm/core-routes` | ✅ 已在 `routes/helloRoute.ts`（但 `execute.ts` 这个壳仍依赖 `buildHelloOptions` / `proxyManager`，详见 2.6） |

### 2.2 可直接迁移的候选（pure-ish, 无 Bun/Hono/shelljs 依赖）

#### ✅ 2.2.1 `discover.ts` — `GET /api/discover`

- **职责**：拉取 `https://raw.gitcode.com/.../config.json` 并归一化为 `{ type, url, authorizationMethod }` 列表。
- **依赖审计**：
  - 纯 `fetch` + `AbortController` + `setTimeout`。
  - 唯一的外部依赖是 `logger` from `'../../lib/logger'` —— **logger 已经走 `ctx.config.logger` 模式，可替换**。
  - 无 `Bun.*`、无 `shelljs`、无 apps/cli 业务依赖。
- **迁移动作**：
  - 提取 `doDiscoverMediaDatabases()` 到 `packages/core-routes/src/discover.ts`。
  - 新增 `routes/discoverRoute.ts`，使用现有 `http.ts` 工具。
  - `apps/cli/src/route/discover.ts` 改为薄壳调用 `doDiscoverMediaDatabases()` 并按 Hono 形式返回。

#### ✅ 2.2.2 `speedtest.ts` — `POST /api/speedtest`

- **职责**：对一组允许的 URL（仅 `github.com` / `gitcode.com`）做 `HEAD` 请求并排序返回最快者。
- **依赖审计**：
  - 纯 `fetch` + `performance.now()` + `AbortController`。
  - 零 apps/cli 依赖。零 `Bun.*`。
  - **唯一可改进**：用 `ctx.config.logger` 替换 `console.log` 风格日志。
- **迁移动作**：抽 `doSpeedtest(urls)` 到 `packages/core-routes/src/speedtest.ts`，新建 `routes/speedtestRoute.ts`。

#### ✅ 2.2.3 `Log.ts` — `POST /api/log`

- **职责**：接收前端日志，转发到 Pino logger；带 10/s 速率限制。
- **依赖审计**：
  - 速率限制器（`RateLimiter` 类）是纯逻辑，不依赖任何平台。
  - `switch (level) → logger.trace/debug/info/warn/error/fatal` 是 core-routes `CoreRoutesLogger` 接口的天然超集 —— 但**目前 core-routes 的 `CoreRoutesLogger` 不包含 `trace` 与 `fatal`**，需要扩展接口。
  - 没有任何 Bun / Hono / 业务依赖。
- **迁移动作**：
  - 在 `types.ts` 中把 `CoreRoutesLogger` 扩展为 `trace` / `fatal`（或者新增一个 `FrontEndLogHandler` 注入点）。
  - `doLog(body, config)` + `routes/logRoute.ts`。
  - apps/cli 这边依然把 pino 适配成 `CoreRoutesLogger` 即可。

#### ✅ 2.2.4 `ReadFile.ts` — `POST /api/readFile`（需要小重构）

- **职责**：根据允许的路径读取文本文件。
- **依赖审计**：
  - 使用 `Bun.file(platformPath).exists()` / `.text()` —— **`Bun.*` 不可移植到 ohos**。
  - 路径校验 `validatePathIsInAllowlist` 已抽到 core-routes（`allowlist.ts`），`apps/cli` 侧有 `path-validator.ts` 包了一层。
  - 其余全是 `path.resolve` / `Path.posix` / `Path.toPlatformPath` 等 `@smm/core` 工具。
- **迁移动作**：
  - 改用 `node:fs/promises.readFile`。
  - `doReadFile(body, config)` 抽到 `packages/core-routes/src/readFile.ts`。
  - `readFileRequestSchema` 与 writeFile 对齐，调用 `validatePathIsInAllowlist(posixPath, config.allowlist)`。
  - apps/cli 端 `route/ReadFile.ts` 保留 Hono 壳。

#### ✅ 2.2.5 `ReadImage.ts` — `POST /api/readImage`（需要小重构）

- **职责**：读取图像文件并以 `data:image/xxx;base64,...` 形式返回。
- **依赖审计**：
  - `Bun.file().arrayBuffer()` —— **不可移植**。
  - 其它逻辑（扩展名校验、MIME 表、Base64 编码）全是 pure。
- **迁移动作**：
  - 改用 `node:fs/promises.readFile` + `Buffer.toString('base64')`。
  - `doReadImage(body)` 抽到 `packages/core-routes/src/readImage.ts`。
  - 新建 `routes/readImageRoute.ts`。

#### ✅ 2.2.6 `MoveFileToTrash.ts` — `POST /api/moveFileToTrash`

- **职责**：把文件移动到系统回收站（headless 时直接删除）。
- **依赖审计**：
  - `node:fs/promises.stat` —— ✅ 可移植。
  - `Path.toPlatformPath` —— `@smm/core` 已共享。
  - `moveFileToTrashOrDelete` from `'../utils/files'` —— **apps/cli 专用，需要搬到 core 或抽象成回调**。
- **迁移动作**：
  - 抽 `doMoveFileToTrash(body)` 到 `packages/core-routes/src/moveFileToTrash.ts`，**核心需求：把 `moveFileToTrashOrDelete` 拆为「移到回收站」+「直接删除」两个 pure 函数并下沉到 core**（或提供 `trash?: (path) => Promise<void>` 注入点）。
  - ohos 端如果不需要“回收站”概念，可以在 `config` 中提供只走 `unlink` 的实现。

#### ✅ 2.2.7 `DeleteFile.ts` — `POST /api/deleteFile`

- **职责**：永久删除 yt-dlp cookies 临时文件（限制路径前缀）。
- **依赖审计**：
  - `node:fs/promises.stat` —— ✅。
  - `isManagedYtdlpCookiesPath(resolvedPath, userDataDir)` from `'@core/whitelistedCmd/ytdlpCookies'` —— **该函数已在 `@smm/core`**，可共享。
  - `permanentlyDeleteFile` from `'../utils/files'` —— apps/cli 专用，需要在 core-routes 重新实现（`node:fs/promises.unlink`）。
  - 路径前缀白名单依赖 `getUserDataDir` from `'@/utils/config'` —— 需要通过 `config` 注入。
- **迁移动作**：
  - `doDeleteFile(body, config)`：从 `config` 读 `allowlist`（与 writeFile 同一套机制）。
  - 用 `node:fs/promises.unlink` 实现 permanent delete。
  - apps/cli 端 `route/DeleteFile.ts` 变薄壳。

#### ✅ 2.2.8 `DownloadImage.ts` — `GET /api/image`（需要小重构）

- **职责**：根据 URL（http/https/file://）返回图片二进制。
- **依赖审计**：
  - `node:fs/promises.readFile` + 全局 `fetch` —— ✅。
  - 路径读 `allowRead(Path.posix(filePath))` from `'../utils/permission'` —— apps/cli 专用，**应当改成走 `config.allowlist` + `validatePathIsInAllowlist`**（与 writeFile/readFile 对齐）。
  - `fileURLToPath` from `'url'` 是 Node 标准库。
  - `extname` from `'path'` 是 Node 标准库。
- **迁移动作**：
  - `doDownloadImage(url, config)` 抽到 `packages/core-routes/src/downloadImage.ts`。
  - 文件路径分支改用 allowlist 校验。
  - apps/cli 端 Hono 壳可继续 `c.req.query('url')` → 调 `doDownloadImage`。

#### ✅ 2.2.9 `DownloadImageAsFile.ts` — `POST /api/downloadImage`（需要小重构）

- **职责**：把远端图片下载到本地指定路径。
- **依赖审计**：
  - `downloadImage(url, path)` from `'@/utils/downloadImage'` —— apps/cli 专用工具；逻辑很简单（`fetch` + `Bun.write`），可重写为 `node:fs/promises.writeFile` 后下沉。
  - **目标路径允许列表**：与 writeFile 一致。
- **迁移动作**：
  - 在 core-routes 新增 `doDownloadImageToFile({ url, path }, config)`，走 `allowlist` 校验。
  - 保持 `POST /api/downloadImage` 协议不变，apps/cli 端薄壳。

### 2.3 需要拆分/部分迁移的候选

#### ⚠️ 2.3.1 `ListDrives.ts` — `GET /api/listDrives`

- **职责**：在 Windows 下用 PowerShell + `net use` / `net view` 列出本地盘与映射的网络盘。
- **依赖审计**：
  - `require('shelljs')` —— **CJS 风格，bun-only**；ohos 走 Node + CJS bundling，需要改为 `import shelljs from 'shelljs'`。
  - 命令调用 (`powershell -NoProfile -Command "..."` / `net use` / `net view`) **仅在 Windows 下有意义**。
  - 解析逻辑（`_parseNetViewOutput` / `_parseNetUseOutput`）是 pure，可下沉。
  - 是否对 ohos 有意义：ohos 走 HarmonyOS 文件系统，列出 Windows 盘符没有意义 —— **结论：apps/cli 专属功能，不必迁到 core-routes**。
- **建议**：保留在 `apps/cli`。但应把 `require('shelljs')` 改成 `import` 形式（与 ohos bundler 兼容，避免 evaluate 时报错）。

#### ⚠️ 2.3.2 `mediaMetadata/{read,write,delete,renameFilesInMediaMetadata}.ts`

- **职责**：把 `MediaMetadata` 序列化到 `{appDataDir}/metadata/<encoded>.json`。
- **依赖审计**：
  - `mediaMetadataDir` = `path.join(getAppDataDir(), 'metadata')` —— 依赖 `getAppDataDir` from `'@/utils/config'`。
  - `findMediaMetadata` / `writeMediaMetadata` / `deleteMediaMetadataFile` 是 `apps/cli/src/utils/mediaMetadata.ts` 内的工具，**强依赖 `getAppDataDir`**。
  - `Bun.file().exists()` / `Bun.file().unlink()` / `Bun.write()` —— **Bun-only**。
  - `read.ts` 还调用 `listFiles(folderPath, true)`，又依赖更多 `apps/cli` 工具。
- **拆分思路**：
  1. 把 `mediaMetadataDir` 改成 `config.metadataDir`（由调用方注入）。cli 端传 `getAppDataDir() + '/metadata'`，ohos 端传 `userData/metadata`。
  2. `findMediaMetadata` / `writeMediaMetadata` / `deleteMediaMetadataFile` 用 `node:fs/promises` 重写后下沉。
  3. `renameFilesInMediaMetadata` 已经 `@deprecated`（注释明确说用 `POST /api/renameFiles`），**应直接删除**而非迁移。
- **风险**：`MediaMetadata` 涉及对 NFO / 媒体库的关键读写，要保证 ohos 在没有 `Bun` 的情况下也能工作。
- **建议**：先迁 `deleteMediaMetadata` 与 `writeMediaMetadata`（逻辑简单），`readMediaMetadata` 因为还需要 `listFiles` 与 `findMediaMetadata` 联动，建议作为第二批迁移。

#### ⚠️ 2.3.3 `execute.ts` (`POST /api/hello` + `POST /api/execute`)

- `POST /api/hello`：已经迁到 `doHello` from core-routes，但是 apps/cli 这边通过 `buildHelloOptions(proxyManager.url)` 注入数据。`buildHelloOptions` 内部读 `version` / `getUserDataDir` / `getAppDataDir` / `getLogDir` / `getTmpDir` / `osLocale` —— 全部是 apps/cli 资源。ohos 端在 `main.js` 里自己实现了 `buildHelloConfig()`，所以 **协议已统一，但配置入口未统一**。
  - **建议**：保留在 apps/cli，但增加 `OHOS_HELLO_EXAMPLE` 文档（main.js 中已有实现可参考）。
- `POST /api/execute`：路由到 `GetSelectedMediaMetadata` / `system` —— 业务调度，**明显是 apps/cli 专属**。ohos 端没有 `/api/execute`。
  - **建议**：保留在 apps/cli。

### 2.4 不建议迁移到 core-routes（业务耦合度太高）

| Route | 关键阻碍 |
|------|---------|
| `RenameFiles.ts` | 调用 `executeBatchRenameOperations` / `updateMediaMetadataAndBroadcast` / `getMediaFolder` / `getUserConfig` / `validateRenameOperations` —— 全部在 `apps/cli/src/utils` 与 `tools`。改名逻辑依赖媒体库元数据，没有跨平台需求。 |
| `RenameFolder.ts` | 修改 `userConfig` + 写 `mediaMetadata` + 广播 socket —— 是 apps/cli 业务核心。 |
| `OpenFile.ts` | `openFile` / `isDesktopEnv` 来自 `apps/cli/src/utils/os`，**ohos（移动设备）没有「桌面打开」语义**。 |
| `OpenInFileManager.ts` | 平台特定 `cmd.exe /c start` / `xdg-open` / `open -R` —— 同上，移动端无对应。 |
| `shutdown.ts` | 强依赖 `isLocalhostShutdownRequest` / `runGracefulShutdown` / `scheduleProcessExit` —— apps/cli 进程生命周期。 |
| `Mcp.ts` | 控制 `apps/cli/src/mcp/mcpServerManager.ts` 的 MCP HTTP server —— 协议与实现都仅 cli 使用。 |
| `ai.ts` / `AICheck.ts` | 走 `@ai-sdk/openai-compatible` + Hono 流；MCP 端已有同名工具，**重复实现**；ohos 不需要。 |
| `Debug.ts` | 内部广播/调用 `tools/renameFilesInBatch` / 删除 user config / 删除 media metadata cache —— dev 专用，**不**应该被 ohos 复用。 |
| `debug/*`（9 个文件） | 全部薄壳，包装 `agentTools.*` 或 `create*Tool` —— `agentTools` 是 apps/cli 私有。 |
| `GetPendingPlans.ts` / `UpdatePlan.ts` | 直接调 `tools/recognizeMediaFilesTool` / `tools/renameFilesToolV2` —— 业务计划队列。 |
| `commandLog.ts` / `commandExecutionLog.ts` / `commandExecutionLogStatus.ts` / `commandExecutionRegistry.ts` / `commandExecutionStatus.ts` | 围绕 `getLogDir()` 和 `commands/<uuid>/main.log` 体系，**仅对 `POST /api/executeCmd` 有意义**，没有 ohos 场景。 |
| `executeCmd.ts` | 整个白名单命令执行 + NDJSON 流 + PTY，是 apps/cli 业务核心。ohos 没有也不该直接 spawn `ffmpeg` / `yt-dlp`。 |
| `tencentAsr/Transcribe.ts` | 调 `transcribeWithTencentAsrHttp` —— 第三方 API 客户端 + 文件读取。ohos 走 HarmonyOS 的 ASR，不应共用。 |
| `discoverExecutables.ts` | 调 `resolveFfmpegPathInfo` / `resolveYtdlpPathInfo` / `resolveVideoCaptionerPathInfo` / `resolveQuickjsPathInfo` —— apps/cli 工具发现，ohos 不需要。 |
| `DownloadImageToTempFile.ts` | 已被 `DownloadImage` 取代，且无 route 注册。 |

---

## 3. 推荐迁移计划（按依赖最少到最多排序）

> 每个候选都建议按 core-routes 现有 `do<Name>`（pure） + `routes/<name>Route.ts`（Node http handler）的两段式拆分。apps/cli 这边保留 Hono 薄壳。

| 优先级 | Route | 工作量 | 备注 |
|------|------|------|------|
| P0 | `discover` | 1h | 无重构，仅替换 logger 来源。 |
| P0 | `speedtest` | 1h | 同上。 |
| P0 | `Log` | 1~2h | 需要先扩展 `CoreRoutesLogger` 加上 `trace` / `fatal`。 |
| P1 | `ReadFile` | 2h | `Bun.file → fs.readFile`，加 allowlist 校验。 |
| P1 | `ReadImage` | 2h | 同上 + 调整 MIME 表。 |
| P1 | `DeleteFile` | 2h | 用 `config.allowlist` 替代 `getUserDataDir`。 |
| P2 | `MoveFileToTrash` | 3h | 需要把 `moveFileToTrashOrDelete` 拆出 pure 函数后下沉，或通过 `config.trash` 注入。 |
| P2 | `DownloadImage` | 3h | 路径分支改用 allowlist 校验。 |
| P2 | `DownloadImageAsFile` | 2h | 与 writeFile 共用 allowlist。 |
| P3 | `mediaMetadata/{read,write,delete}` | 4h | 先迁 delete/write；read 依赖 `listFiles`，待 2.2.4 落定后再迁。 |
| — | `mediaMetadata/renameFilesInMediaMetadata` | 30m | **删除**（已 `@deprecated`）。 |
| — | `DownloadImageToTempFile` | 30m | **删除**（未被注册）。 |

完成后，`packages/core-routes` 维护的 route 集合大致为：

```
POST /api/hello              ✅
GET  /api/listFiles          ✅
POST /api/listFiles          ✅
POST /api/writeFile          ✅
POST /api/isFolderAvailable  ✅
GET  /api/discover           🆕
POST /api/speedtest          🆕
POST /api/log                🆕
POST /api/readFile           🆕
POST /api/readImage          🆕
POST /api/deleteFile         🆕
POST /api/moveFileToTrash    🆕
GET  /api/image              🆕
POST /api/downloadImage      🆕
POST /api/readMediaMetadata  🆕 (P3)
POST /api/writeMediaMetadata 🆕 (P3)
POST /api/deleteMediaMetadata🆕 (P3)
```

---

## 4. 验证手段

每次迁移应同时满足：

1. **类型**：`pnpm --filter @smm/core-routes typecheck` 与 `pnpm --filter cli typecheck` 通过。
2. **单元测试**：在 `packages/core-routes` 内用 vitest 覆盖 `do<Name>()` 与 `<name>Route` handler（参考 `isFolderAvailable.test.ts`）。
3. **回归测试**：`apps/cli` 原 `*.test.ts` 通过。
4. **ohos 端冒烟**：重新跑 `pnpm --filter ohos build:core-routes && copy-core-routes`；在 ohos electron 主进程里对 `http://127.0.0.1:18081/api/<name>` 发送一个最小请求，确认能命中 handler。
5. **回归**：`apps/e2e` 中相关 spec（如涉及 `readFile` / `writeFile`）通过。

---

## 5. 总结

- 当前 `apps/cli` 一共 ~45 个 route 文件（含 `debug/*`）。其中 **3 个**（`ListFiles` / `WriteFile` / `IsFolderAvailable`）+ `POST /api/hello` 已经在 core-routes。
- 另有 **9 个**（`discover` / `speedtest` / `Log` / `ReadFile` / `ReadImage` / `DeleteFile` / `MoveFileToTrash` / `DownloadImage` / `DownloadImageAsFile`）**无重大阻碍**，按上述 P0~P2 计划落地。
- **3 个**（`mediaMetadata/*`）属于「可以拆但有依赖链」，建议第二批处理；其中 `renameFilesInMediaMetadata` 已 `@deprecated`，**应当直接删除**。
- 其余 **30+ 个 route**（`RenameFiles` / `RenameFolder` / `Open*` / `shutdown` / `Mcp` / `ai*` / `Debug*` / `commandLog*` / `executeCmd` / `tencentAsr` / `discoverExecutables` / `GetPendingPlans` / `UpdatePlan` 等）**与 apps/cli 业务/平台生命周期深度耦合**，不应该下放到 core-routes，ohos 端继续保持纯静态/桥接式的存在即可。
