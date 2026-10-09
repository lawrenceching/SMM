# Hono RPC 重构计划: apps/ui ↔ apps/server 类型安全

> **Status: 全部 11 个任务已完成** (Task 11 收尾 commits: 01824894 清理 + 62912fd3 文档, 2026-10-08; 全量 knip/typecheck/build/test 绿)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 apps/ui 与 apps/server 之间的 HTTP 交互迁移到 Hono RPC (`hono/client` 的 `hc`), 让请求/响应/路径/方法在一处定义、两端推导, 消除手写重复 interface。

**Architecture:** 服务端把路由模块从命令式 `handleXxx(app: Hono)` 改为导出 `const xxxRoute = new Hono().post(...)`, 由 `createApp()` 以 `.route()` 链式组合并导出 `AppType`; 客户端用 `hc<AppType>('', { fetch: apiFetch })` 生成类型化 client, 复用现有 auth 注入与 401 处理。迁移期间新旧两套注册方式并存: 未迁移路由继续 `handleXxx(this.app)` 命令式注册(运行时有效、不进 AppType), 已迁移路由加入 `.route()` 链。

**Tech Stack:** Hono 4 (内置 `hc` / `validator`)、zod 4 (已有)、React 19 + TanStack Query (UI)、Vitest (server 路由测试)。

## Global Constraints

- 线上协议不变: 所有 path/method/status code 与合法请求的 JSON 结构保持逐字节一致(仅 TS 类型层面重构; 响应类型从 `{ data?: X; error?: string }` 收紧为判别联合 `{ data: X } | { error: string }`, 运行时 JSON 不变)。
- 不新增校验依赖: 请求体校验用 hono 内置 `validator` middleware + 已有 zod (`apps/server` 已依赖 `zod ^4.1.8`, 实测安装 4.3.6)。
- `apps/ui` 新增 `hono` 依赖(运行时需要 `hono/client` 的 `hc`)。
- `apps/ui` tsconfig paths 新增 `"@smm/server": ["../server/app.ts"]`(type-only import, 构建产物零增长)。
- 保留 `apiFetch` 的端点: core-routes 公共 API(见范围表)、`/proxy` 反向代理、Socket.IO、NDJSON 流(`/api/executeCmd`)、二进制图像端点。
- 代码不加注释(遵循仓库约定); 迁移既有代码时保留其原有注释。
- 提交前验证(仓库 Pre Commit 约定): `pnpm knip && pnpm typecheck && pnpm build && pnpm test`。
- 提交信息风格: conventional commits, 如 `refactor(server): convert GetFolders route to Hono RPC`。

---

## 背景

- `apps/server/src/route/` 共约 60 个路由文件, 均为 `handleXxx(app: Hono)` 命令式注册, 各自手写请求/响应 interface。
- `apps/ui/src/api/` 共 84 个文件, 其中 47 个手写 `ResponseBody` interface, 与服务端重复定义、存在漂移风险。
- 客户端统一走 `apps/ui/src/lib/apiFetch.ts`(注入 Authorization + `notifyUnauthorizedApiResponse`)。
- 路由分发: `apps/server/server.ts` 的 HTTP server 先按 `isCoreRoute` 分发到 `packages/core-routes`(纯 node http, 非 Hono), 其余落到 Hono app。

## 范围界定

### In scope(Hono 路由, 迁移为 RPC)

| 组 | server 路由文件 | UI api 文件 |
|---|---|---|
| 元数据 | `src/route/metadata/GetMetadata.ts`, `CreateMetadata.ts`, `SetMetadata.ts`, `DeleteMetadata.ts`, `src/route/FolderMetadata.ts`, `src/route/mediaMetadata/renameFilesInMediaMetadata.ts` | `api/metadata.ts` 及 `hooks/mediaMetadata/**` 调用点 |
| 识别/重命名 | `RecognizeFolder.ts`, `Scrape.ts`, `TryToRecognizeEpisodes.ts`, `RecognizeEpisodesPlan.ts`, `RenameEpisodeFile.ts`, `RenameEpisodesPlan.ts`, `validateRenameOperations.ts`, `ListDrives.ts`, `ai.ts` | `api/scrape.ts`, `api/createRecognizeEpisodePlan.ts`, `api/applyPlan.ts` 等(以文件中调用的 path 为准) |
| 媒体库 | `ImportFolder.ts`, `ImportLibrary.ts`, `UnimportFolder.ts`, `SetWatchedFolder.ts`, `ShowFolder.ts`, `OpenFile.ts`, `OpenInFileManager.ts`, `MoveFileToTrash.ts` | `api/importFolder.ts`, `api/importLibrary.ts`, `api/moveFileToTrash.ts`, `api/openFile.ts`, `api/openInFileManager.ts` 等 |
| 任务 | `GetJob.ts`, `StopJob.ts`, `GetJobLog.ts`, `execute.ts` | `api/getJob.ts`, `api/getJobLog.ts` 等 |
| 外部 API | `Tmdb.ts`, `Tvdb.ts`, `CoreFetch.ts`, `discoverExecutables.ts`, `speedtest.ts`, `shutdown.ts`, `tencentAsr/Transcribe.ts` | `api/tmdb.ts`, `api/tvdb.ts`, `api/discoverExecutables.ts` 等 |
| 命令 | `commandExecutionStatus.ts`(路径参数), `commandLog.ts` | `lib/commandExecutionStatusPoller.ts`, `lib/commandLogTerminal.ts` 调用点 |
| 调试(可选) | `debug/` 下 11 个文件 | 无 UI 调用, 仅服务端迁移 |

### Out of scope(保留 apiFetch / 裸 fetch)

- core-routes 公共 API(非 Hono): `/api/hello`, `/api/listFiles`, `/api/writeFile`, `/api/readFile`, `/api/deleteFile`, `/api/deleteFolder`, `/api/isFolderAvailable`, `/api/getEpisodes`, `/api/listFilesInMediaFolder`, `/api/renameFiles`, `/api/image`, `/api/downloadImage`, `/api/readImage`, `/api/discover`, `/api/chat`, `/api/mcp/*`, `/api/get-mcp-server-status`, `/api/start-mcp-server`, `/api/stop-mcp-server`, `/api/getPlans`, `/api/getPlanById`, `/api/createPlan`, `/api/updatePlan`, `/api/getUserConfig`, `/api/patchUserConfig`, `/api/rename-folder`(core-routes 优先分发)。
- 流式/二进制: `/api/executeCmd`(NDJSON stream)、`/api/log`(sendBeacon, 无 Authorization header)。
- 其他传输: `/proxy` 反向代理、`/socket.io/`、静态资源。

---

## 文件结构

**Create:**
- `apps/server/app.ts` — `createApp(deps)` 组合中间件 + 已迁移路由的 `.route()` 链, `export type AppType = ReturnType<typeof createApp>`
- `apps/ui/src/lib/rpc.ts` — `hc<AppType>('', { fetch: apiFetch })` 类型化 client

**Modify:**
- `apps/server/server.ts` — 改用 `createApp()`; 中间件(requestId/logging/cors/no-cache/auth)移入 app.ts; 已迁移路由的 `handleXxx` 调用删除; `start()` 中的 `registerExecuteRoutes(this.app)` 删除
- `apps/server/src/route/*.ts` — 逐个改为 route module + 对应 `*.test.ts`
- `apps/ui/src/api/*.ts` — 逐个改用 `rpc`
- `apps/ui/package.json` — 新增 `hono` 依赖
- `apps/ui/tsconfig.json` — paths 新增 `@smm/server`
- `docs/api/index.md`、`AGENTS.md` — 更新前后端通信说明

---

## Task 1: 服务端基础设施 — createApp + AppType ✅ (commit 0688bf68)

**Files:**
- Create: `apps/server/app.ts`
- Modify: `apps/server/server.ts:154-195,221-357,369-383`
- Test: 既有 `apps/server/src/route/*.test.ts` 全量回归

**Interfaces:**
- Consumes: `hono` (`Hono`, `requestId`, `cors`), `@smm/core-routes` (`isRequestAuthorized`, `CoreRoutesAuthConfig`, `CoreRoutesLogger`), 既有 `handleXxx` 函数
- Produces: `createApp(deps: CreateAppDeps)`(返回类型由 `.use()/.route()` 链推断, 不加 `: Hono` 注解)、`export type AppType = ReturnType<typeof createApp>`、`export interface CreateAppDeps { auth?: CoreRoutesAuthConfig; logger: CoreRoutesLogger }`

- [x] **Step 1: 创建 apps/server/app.ts**(中间件从 server.ts 原样搬移; 此时路由链为空, 只含中间件)

```ts
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { cors } from 'hono/cors'
import type { CoreRoutesAuthConfig, CoreRoutesLogger } from '@smm/core-routes'
import { isRequestAuthorized } from '@smm/core-routes'

export interface CreateAppDeps {
  auth?: CoreRoutesAuthConfig
  logger: CoreRoutesLogger
}

export function createApp(deps: CreateAppDeps) {
  const app = new Hono()

  app.use(requestId())

  app.use(async (c, next) => {
    const reqId = c.get('requestId')
    const method = c.req.method
    const path = c.req.path
    if (path.includes('/socket.io/')) {
      return next()
    }
    const start = Date.now()
    deps.logger.debug({ requestId: reqId, method, path }, 'incoming request')
    await next()
    const duration = Date.now() - start
    const status = c.res.status
    deps.logger.info({ requestId: reqId, method, path, status, duration: `${duration}ms` }, 'request completed')
  })

  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Timeout', 'X-Command-Execution-Id'],
      exposeHeaders: ['X-Command-Execution-Id', 'X-Command-Log-Path', 'X-Resolved-Executable-Path'],
    }),
  )

  app.use('/api/*', async (c, next) => {
    await next()
    if (c.req.method === 'OPTIONS') return
    const cacheControl = c.res.headers.get('Cache-Control')
    const allowsCaching = cacheControl && /\b(public|private|max-age|s-maxage|immutable)\b/.test(cacheControl)
    if (!allowsCaching) {
      c.res.headers.set('Cache-Control', 'no-store')
    }
  })

  app.use('/api/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return next()
    }
    if (c.req.path === '/api/log') {
      return next()
    }
    if (!isRequestAuthorized(c.req.header('Authorization'), deps.auth)) {
      return c.json({ error: 'Unauthorized: invalid or missing token' }, 401)
    }
    return next()
  })

  return app
}

export type AppType = ReturnType<typeof createApp>
```

- [x] **Step 2: server.ts 改用 createApp**

将构造函数中 `this.app = new Hono(); this.app.use(requestId())` 及后续 4 段中间件注册(原 server.ts:154-267)替换为:

```ts
this.app = createApp({ auth: this.auth })
```

同时将 `private app: Hono;` 改为 `private app: ReturnType<typeof createApp>;`。

- [x] **Step 3: start() 删除 execute 注册**

删除 `apps/server/server.ts:382` 的 `registerExecuteRoutes(this.app);`, 并删除对应 import(`./src/route/execute`)。`/api/execute` 将在 Task 6 以 route module 形式加入 `.route()` 链(其 handler 不依赖 reverse-proxy 配置, 提前注册无行为差异)。本任务期间 `/api/execute` 暂时不可用, 由 Task 6 恢复; 若期间有 e2e 依赖该端点, 可在 Task 6 完成前保留此行(冗余注册无害)。

- [x] **Step 4: 验证**

```bash
pnpm --filter server typecheck
pnpm --filter server test
```

Expected: 全部通过(路由测试不经过 server.ts, 不受影响)。

- [x] **Step 5: Commit**

```bash
git add apps/server/app.ts apps/server/server.ts
git commit -m "refactor(server): extract createApp + AppType foundation for Hono RPC"
```

---

## Task 2: UI 客户端基础设施 — rpc.ts ✅ (commit 2bd2eacd + d03809df)

**Files:**
- Create: `apps/ui/src/lib/rpc.ts`
- Modify: `apps/ui/package.json`, `apps/ui/tsconfig.json`
- Test: `(cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用`

**Interfaces:**
- Consumes: Task 1 的 `AppType`, `apps/ui/src/lib/apiFetch.ts` 的 `apiFetch`
- Produces: `export const rpc = hc<AppType>('', { fetch: apiFetch })`(后续所有 Task 使用)

- [x] **Step 1: apps/ui 新增 hono 依赖**

```bash
pnpm --filter ui add hono@^4.10.8
```

- [x] **Step 2: tsconfig paths 新增别名**

`apps/ui/tsconfig.json` 的 `compilerOptions.paths` 增加:

```json
"@smm/server": ["../server/app.ts"]
```

- [x] **Step 3: 创建 apps/ui/src/lib/rpc.ts**

```ts
import { hc } from 'hono/client'
import type { AppType } from '@smm/server'
import { apiFetch } from '@/lib/apiFetch'

export const rpc = hc<AppType>('', { fetch: apiFetch })
```

注: `hc` 的 `fetch` 选项类型为 `typeof fetch | HonoRequest`, `apiFetch(input: RequestInfo | URL, init?: RequestInit)` 结构兼容; baseUrl 为空串 + 自定义 fetch 使请求保持相对路径 `/api/...`, 兼容 Vite dev proxy 与生产同源部署。

- [x] **Step 4: 验证**

```bash
(cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用
```

Expected: 通过。若报 `hono/bun` 或 bun 类型解析错误, 说明 AppType 链引入了 bun 类型依赖, 回到 Task 1 检查 app.ts 是否误引用了 `serveStatic`(它必须留在 server.ts, 见 Global Constraints)。

- [x] **Step 5: Commit**

```bash
git add apps/ui/src/lib/rpc.ts apps/ui/package.json apps/ui/tsconfig.json pnpm-lock.yaml
git commit -m "feat(ui): add typed hono RPC client wrapper"
```

---

## Task 3: Pilot 全链路 — GetFolders ✅ (commits 2ad099b3 + 6b8beff2 + c43804f9)

第一个端到端试点, 验证「route module + `.route()` 组合 + hc client + auth 注入」全链路。

注意: `createApp` 不得添加返回类型注解(如 `: Hono`), 否则 `.route()` 组合产生的链式类型会被擦除, `hc<AppType>` 将得不到任何路由类型。

注意 (Task 2 遗留): 本任务开始消费 `rpc` 后, 需移除 `knip.json` 中 `workspaces["apps/ui"].entry` 里的临时条目 `"src/lib/rpc.ts"` (Task 2 落地时 rpc 无使用者, knip 报 unused file/dependency 而临时加入)。

**Files:**
- Modify: `apps/server/src/route/GetFolders.ts`
- Modify: `apps/server/src/route/GetFolders.test.ts`
- Modify: `apps/server/app.ts`(`.route()` 链加入本路由)
- Modify: `apps/server/server.ts`(删除 `handleGetFolders` 注册与 import)
- Modify: `apps/ui/src/api/getFolders.ts` 及其全部调用点(`rg "getFolders" apps/ui/src` 定位, 预期含 `hooks/userConfig/useAddMediaFolderMutation.ts` 等)

**Interfaces:**
- Consumes: Task 1 `createApp`, Task 2 `rpc`
- Produces: `export const getFoldersRoute: Hono<...>`、`export type GetFoldersResponseBody = { data: { folders: string[] } } | { error: string }`; UI 侧 `getFolders(signal?): Promise<string[]>`(错误时 throw)

- [x] **Step 1: 改造 GetFolders.ts 为 route module**

`apps/server/src/route/GetFolders.ts` 整体替换为:

```ts
import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export type GetFoldersResponseBody =
  | { data: { folders: string[] } }
  | { error: string }

export const getFoldersRoute = new Hono().post('/api/get-folders', async (c) => {
  try {
    try {
      await c.req.json()
    } catch {
      /* empty body OK */
    }
    const folders = await getCore().getFolders()
    return c.json<GetFoldersResponseBody>({ data: { folders } }, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/get-folders] route error')
    return c.json<GetFoldersResponseBody>(
      { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
      200,
    )
  }
})
```

- [x] **Step 2: 更新测试**

`apps/server/src/route/GetFolders.test.ts` 中:

```ts
import { getFoldersRoute } from './GetFolders'
```

`beforeEach` 中删除 `app = new Hono(); handleGetFolders(app)`, 改为:

```ts
app = getFoldersRoute
```

- [x] **Step 3: 运行测试确认通过**

```bash
pnpm --filter server test GetFolders
```

Expected: 2 个用例通过(断言 `{ data: { folders } }` 与响应 JSON 结构不变)。

- [x] **Step 4: 加入 .route() 链**

`apps/server/app.ts` 的 `createApp` 中, `return app` 前改为:

```ts
const composed = app.route('/', getFoldersRoute)
return composed
```

并新增 import:

```ts
import { getFoldersRoute } from './src/route/GetFolders'
```

- [x] **Step 5: 删除 server.ts 中的旧注册**

删除 `apps/server/server.ts` 中 `handleGetFolders(this.app);` 与顶部 `import { handleGetFolders } from './src/route/GetFolders';`。

- [x] **Step 6: 迁移 UI 调用**

`apps/ui/src/api/getFolders.ts` 替换为:

```ts
import { rpc } from '@/lib/rpc'

export async function getFolders(signal?: AbortSignal): Promise<string[]> {
  const resp = await rpc.api['get-folders'].$post({}, { init: { signal } })
  const body = await resp.json()
  if ('error' in body) throw new Error(body.error)
  return body.data.folders
}
```

用 `rg "getFolders" apps/ui/src` 定位全部调用点, 逐个适配新签名(原先解析 `GetFoldersResponseBody` 的 `data?.folders`/`error` 分支改为直接使用返回值或 try/catch)。

- [x] **Step 7: 验证全链路**

```bash
pnpm --filter server typecheck && pnpm --filter server test
(cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用
pnpm knip
```

Expected: 全部通过; `knip` 不报 `GetFoldersResponseBody` 旧 export 未使用(UI 不再 import 旧类型)。

- [x] **Step 8: Commit**

```bash
git add apps/server/src/route/GetFolders.ts apps/server/src/route/GetFolders.test.ts apps/server/app.ts apps/server/server.ts apps/ui/src/api/getFolders.ts
git commit -m "refactor: migrate get-folders to typed Hono RPC end-to-end"
```

---

## Task 4: Pilot — 路径参数 commandExecutionStatus ✅ (commit 2989e560)

验证 `:param` 路径参数的 RPC 类型。

**Files:**
- Modify: `apps/server/src/route/commandExecutionStatus.ts` 及其 `.test.ts`
- Modify: `apps/server/app.ts`, `apps/server/server.ts`
- Modify: `apps/ui/src/lib/commandExecutionStatusPoller.ts` 中的 fetch 调用(`rg "command-execution" apps/ui/src` 定位)

**Interfaces:**
- Consumes: Task 1/2/3
- Produces: `export const commandExecutionStatusRoute = new Hono().get('/api/command-execution/:executionId', ...)`, 响应 `export type CommandExecutionStatusResponseBody = { data: ... } | { error: string }`

- [x] **Step 1: 改造 route module**(保持原有校验逻辑, 仅换注册方式与响应类型)

`apps/server/src/route/commandExecutionStatus.ts` 整体替换为:

```ts
import { Hono } from 'hono'
import { isCommandExecutionId } from './commandLog'
import {
  getCommandExecutionRegistryStatus,
  type CommandExecutionStatus,
} from './commandExecutionRegistry'
import { readCommandExecutionStatusFromLog } from './commandExecutionLogStatus'

async function resolveCommandExecutionStatus(
  executionId: string,
): Promise<CommandExecutionStatus> {
  const fromRegistry = getCommandExecutionRegistryStatus(executionId)
  if (fromRegistry) return fromRegistry

  const fromLog = await readCommandExecutionStatusFromLog(executionId)
  if (fromLog) return fromLog

  return {
    executionId,
    found: false,
    phase: 'unknown',
  }
}

export type CommandExecutionStatusResponseBody = CommandExecutionStatus | { error: string }

export const commandExecutionStatusRoute = new Hono().get(
  '/api/command-execution/:executionId',
  async (c) => {
    const executionId = c.req.param('executionId') ?? ''
    if (!isCommandExecutionId(executionId)) {
      return c.json<CommandExecutionStatusResponseBody>({ error: 'Invalid execution id' }, 400)
    }

    const status = await resolveCommandExecutionStatus(executionId)
    return c.json<CommandExecutionStatusResponseBody>(status)
  },
)
```

注: 该路由 200 响应是裸 `CommandExecutionStatus`(无 `data` 包装, 保持 wire 兼容); 客户端用 `'error' in body` 判别(`CommandExecutionStatus` 无 `error` 字段)。

- [x] **Step 2: 更新测试、加入 `.route('/', commandExecutionStatusRoute)`、删除 server.ts 旧注册**

同 Task 3 Step 2/4/5。

- [x] **Step 3: UI 调用点迁移**

`rg "command-execution" apps/ui/src` 定位调用点(预期 `src/lib/commandExecutionStatusPoller.ts`), 将其 fetch 调用替换为:

```ts
const resp = await rpc.api['command-execution'][':executionId'].$get({ param: { executionId } })
const body = await unwrapJson(resp)
if ('error' in body) throw new Error(body.error)
return body
```

保留原有轮询/超时/错误处理逻辑, 仅替换请求层。

- [x] **Step 4: 验证**

```bash
pnpm --filter server typecheck && pnpm --filter server test
(cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用
```

Expected: 全部通过。

- [x] **Step 5: Commit**

```bash
git add apps/server/src/route/commandExecutionStatus.ts apps/server/app.ts apps/server/server.ts apps/ui/src
git commit -m "refactor: migrate command-execution-status route with path param to Hono RPC"
```

---

## 标准迁移模式(后续所有分组任务复用)

以下步骤为每个路由文件的标准流程, 分组任务中不再逐字重复:

1. **server 路由模块化**: 文件末尾 `export function handleXxx(app: Hono): void { app.method('/path', handler) }` → `export const xxxRoute = new Hono().method('/path', handler)`; 响应 interface 改为判别联合 `export type XxxResponseBody = { data: T } | { error: string }`, 所有 `c.json(...)` 加泛型 `c.json<XxxResponseBody>(...)`。
   **hono 4.13 泛型边界 (Task 5/6 两轮 probe 实测, 以 Task 6 修正为准)**: `c.json<显式泛型>(字面量参数, 200)` **不会**退化 status 推断 — `resp.ok` 仍可收窄; 真正的坑是**联合类型变量先赋值再传给 c.json**: TS 赋值收窄使 T 按分支裂成多个 ClientResponse, `unwrapJson` 推断失败。约定: 全 200 路由用显式泛型 + 文件内 type 联合 (Task 3/6 先例); 混合模板 (200+400 problem+json) 200 分支显式泛型、400 problem 分支省略泛型 (Task 6 apply-plan 先例, probe 实证 status 字面量保留); 响应类型一律改判别联合 (可选字段 `data?/error?` 会让 `'error' in body` 收窄后 data 仍缺省, UI 过不了 tsc)。
   **客户端变体 — problem+json 路由** (200 `{data}` | 4xx/5xx `application/problem+json`, Task 5 metadata 组先例): 此类路由**不走 unwrapJson** — `if (!resp.ok) { const problem = await resp.json(); throw new XxxHttpError(problem, resp.status) }`, 200 分支才走 `unwrapJson`(hono 按 status 字面量对联合收窄, 零 cast)。这类路由也必须跳过 validator('json') (其自带 400 文本响应会破坏 problem+json wire), 保留 handler 内 zod `.parse` + problem json。
   **变体 2 — 非 problem+json 的多 status** (Task 9 OpenInFileManager 等, 4 个 400 + 默认 200, body 为路由自有 error 形状而非 RFC7807): 机制同 problem+json 变体 (`if (!resp.ok)` + 读 body), 但 body 类型是路由自有形状 — 勿假设 4xx 必为 ProblemDetails。
   **变体 3 — 混合模板** (Task 6 `/api/apply-plan`: 200 `{data}|{error}` **且** 400 problem+json): 组合式 `if (!resp.ok) { const problem = await resp.json(); throw ... }` + 200 分支再做 `'error' in body` 判别。UI 对 problem.detail 的处理保持现状 (现 UI 丢弃 detail 只用 statusText), 不借迁移改 UX。
   **catch-all 形状路由 (wire 不可改)**: `validateRenameOperations` 的 catch 返回 `{ data: null, error }`、`MoveFileToTrash` 的 catch 返回 `{ data: { path: '' }, error }`、`ListDrives` 的 500 返回 `{ data: [], error }` — 全局约束「运行时 JSON 不变」优先于纯判别联合, 保留宽联合类型 (如 `{ data: T | null; error?: string }`) 原样导出, 客户端按实际形状适配。
   **problemDetails 共享 status 联合注记**: `metadataProblemJson` 的 `400|404|409|500` 是共享 helper 的最大集, 不是逐路由承诺 (如 delete 永不 404/409); 客户端只依赖 `resp.ok` 与 number 型 `resp.status`, 勿对 status 做穷举收窄。
   **validator 的 Content-Type 门控 (Task 6 审查发现, Task 7-10 必读)**: hono 的 `validator('json')` 只在请求 `Content-Type` 匹配 JSON 正则时才解析 body, 否则跳过解析、以 `{}` 调 hook (→ 400 Validation failed); 而手工 `c.req.json()` 不看 header。旧客户端 (cli/e2e/外部脚本) 若带合法 JSON body 但缺/错 Content-Type, validator 路由会 400 而旧代码可能正常分发。默认保守: 迁移时**保留手工解析**, 仅在 wire 明确不受影响 (如 execute.ts, plan 授权) 时才换 validator。
   **unwrapJson 两种调用形态的取舍 (Task 6 沉淀)**: 要保留该路由旧版错误文案 → 先 `if (!resp.ok) throw new Error(<旧文案>)` 再 `unwrapJson(resp)` (applyPlan/rejectPlan/tryToRecognizeEpisodes/tryToRenameEpisodes 先例; 此时 unwrapJson 内的 ok 检查在该路径冗余但无害); 无旧文案顾虑 → 直接 `unwrapJson(resp)`。勿逐文件掷硬币。
   **`resp.ok` 判别是条件性的 (Task 6/9 两轮 probe 修正)**: hono ≥4.13 的 `ClientResponse.ok` 类型为 `U extends SuccessStatusCode ? true : false`, 但仅在路由的 status **字面量端到端保留**时成立; 多分支联合若使 status 退化为 `ContentfulStatusCode`, `ok` 变宽为 `boolean`, 此时客户端改用 "'error' in body" 运行时守卫收窄 (Task 9 speedtest 先例)。不确定时跑临时 probe 实测, 勿凭路由形状推断。
2. **请求体类型化**(有请求体的路由): 引入 zod schema(尽量复用 `@smm/types` 中已有 DTO 的 schema), 用 hono 内置 validator:

```ts
import { validator } from 'hono/validator'

const xxxRoute = new Hono().post('/api/xxx', validator('json', (value, c) => {
  const parsed = xxxRequestSchema.safeParse(value)
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400)
  return parsed.data
}), async (c) => {
  const body = c.req.valid('json')
  // ...
})
```

注: 无请求体/容忍空 body 的路由(如 get-folders)跳过本步。此步会改变「无效请求」的响应(400 + details), 合法请求行为不变, 属可接受收紧。
3. **测试**: `*.test.ts` 中 `app = new Hono(); handleXxx(app)` → `app = xxxRoute`; 断言 JSON 结构不变。**每个路由至少一个错误路径用例**(stub 依赖 reject, 断言 200 + `{ error: /^Error Reason:/ }` — 整个 `'error' in body` 判别设计依赖这个契约, 见 Task 3 试点)。
4. **组合**: `apps/server/app.ts` 的 createApp 内追加 `.route('/', xxxRoute)` + import; 删除 `apps/server/server.ts` 中对应 `handleXxx` 调用与 import。链式写法用 `return app.route('/', aRoute).route('/', bRoute)...`(Task 4 起不再用 `const composed` 中间变量)。
5. **UI 迁移**: 对应 `apps/ui/src/api/*.ts` 改用 `rpc` + `unwrapJson`(定义于 `apps/ui/src/lib/rpc.ts`: `resp.ok` 为假时 throw `HTTP Layer Error: <status> <statusText>` — 传输层失败(404 text/500/proxy HTML)必须先于 JSON 解析暴露, 否则 `SyntaxError` 吞掉状态码; 200 + `{error}` 的应用层契约仍由 `'error' in body` 判别):

```ts
const resp = await rpc.api['xxx'][...].$post({ json: body })
const data = await unwrapJson(resp)
if ('error' in data) throw new Error(data.error)
return data.data
```

**例外 — 非 JSON 200 成功体的端点**(如 Task 8 的 `/api/command-log/:executionId`, 成功返回 `c.body(Uint8Array)` text/plain, 错误才是 `c.json({error})`): 不得用 JSON 模板, 用变体 `if (!resp.ok) { const body = await resp.json().catch(() => null); throw new Error(body?.error ?? \`HTTP ${resp.status} ${resp.statusText}\`) }; return resp.text()`(以状态码区分成功/失败; `.catch` 加固为 Task 8 审查要求 — 非 JSON 错误体如 dev 代理 HTML 500 不得抛裸 SyntaxError 吞状态码)。

用 `rg "<api 文件名>" apps/ui/src` 定位全部调用点适配。**注意**: 若某 UI 文件调用的 path 属于 Out of scope 列表(如 `/api/getPlans` 是 core-routes), 该文件不迁移。

**模板语义约定 (Task 4 审查沉淀, 复制模板前必读):**
- `'error' in body` 是**纯类型收窄 guard**, 不是 400 处理: 非 2xx 一律由 `unwrapJson` 先抛 `HTTP Layer Error: <status> <statusText>`(4xx 的响应体文本 UI 永远看不到); 应用层错误消息要透达 UI, 路由必须自己 try/catch 并返回 200 + `{ error }`(Task 3 契约, 第 3 步的错误路径用例锁的就是它)。无 try/catch 兜底的路由(如 command-execution-status)该行在运行时不可达, 属预期。
- 消费方需要"具体数据类型"时**从 rpc 推导, 勿手写 interface** (Task 6 修正后的可编译形式): `type XxxResponseBody = Awaited<ReturnType<Awaited<ReturnType<(typeof rpc)['api']['xxx']['$post']>>['json']>>`(外层 Awaited 必须; `((typeof rpc)['api']['x']['$post'])['json']` 直取会报 TS2339); 具体数据 `type XxxData = Exclude<XxxResponseBody, { error: string }>`; `{ data: T } | { error }` 路由再取 `['data']`。TS 语法坑: 类型位置 `typeof rpc.api['a'][':b'].$get` 报 TS1005, 必须全括号 `(typeof rpc)['api'][...]['$get']`。多 status 成员联合下自动推断不可靠时, 用显式类型参数 `unwrapJson<XxxResponseBody>(resp)` (Task 6 ListDrives 先例)。
- hc 的 path param **不做 URL 编码且空串会删掉整段路径**(`replaceUrlParam`), 仅 UUID/受控值域可直接用; 任意字符串需调用方自行 `encodeURIComponent`。
- `unwrapJson` 签名在 Task 5 升级为 `unwrapJson<T>(resp: Response & { json(): Promise<T> }): Promise<T>`, 调用点免显式泛型(`const body = await unwrapJson(resp)` 自动推断); 已有调用点(getFolders、commandExecutionStatus)随 Task 5 一并去掉显式泛型。
6. **验证**: `pnpm --filter server typecheck && pnpm --filter server test && (cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip`, 然后分组 commit。

### ui 类型摩擦已批准修法清单 (Task 3 试点沉淀, 逐案最小修复, 超出清单的琐碎同类修复可沿用, 非琐碎的报 DONE_WITH_CONCERNS)

- `@server/*` 解析失败 → ui 两个 tsconfig 已加 `"@server/*": ["../server/src/*"]` (Task 3 已完成, 无需重复)。
- erasableSyntaxOnly 参数属性 → 显式字段 + 构造函数赋值 (见 commit d03809df 模式)。
- Buffer→BodyInit → 零拷贝 `new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)`; duplex → 局部交叉类型; 禁止全局 interface 合并。
- i18next `t` 动态键被 ui 的严格键增强拒绝 → 模块内局部类型绑定 `const translate = i18n.t as (key: string, options?: { ns: string }) => string` (Task 3, `src/i18n/helpers.ts` 模式; 一次性修复可用, 勿把裸 cast 上升为跨文件公共模式 — 需要时包一个导出的类型化 helper)。
- `Bun` 全局在 ui 下不可见 → **集中式**方案(勿用逐文件 `declare const Bun` — 会遮蔽 server 自身 typecheck 里的真实 @types/bun 类型并随迁移扩散): 落地方案为单一 `apps/ui/src/types/bun-globals.d.ts` ambient 文件(ui-only, 不影响 server), 当前覆盖 `Bun.serve` 与 `Bun.file(exists/text)`; **注意**: `types: ["vite/client", "bun"]` + ui devDep `@types/bun` 方案已实测否决 — Bun 的 Response(需 textStream)/fetch(需 preconnect)/ReadableStream(BYOB) 类型面与 ui DOM lib 系统性冲突(ui 自身 src + core-routes 共 8 错), 不要重试。Task 5 后该 d.ts 已覆盖 server 全部已知 Bun API 面 (`Bun.file` exists/text/json、`Bun.write`、`Bun.serve` — 已全量清点), 仅在迁移中引入新 Bun API 时扩展, 勿预防性加宽。
- `.route()` 组合后 `app.test.ts` 的探测路由若与已迁移 path 冲突 → 探测 path 换成无冲突路径 (如 `/api/auth-probe`)。

---

## Task 5: 分组迁移 A — 元数据 ✅ (commits e200357e + 708ef3ac)

**Files:**
- server: `src/route/metadata/GetMetadata.ts`, `CreateMetadata.ts`, `SetMetadata.ts`, `DeleteMetadata.ts`, `src/route/FolderMetadata.ts`, `src/route/mediaMetadata/renameFilesInMediaMetadata.ts`(+ 各自 `.test.ts` 若存在)
- Modify: `apps/server/app.ts`, `apps/server/server.ts`
- ui: `src/api/metadata.ts` 及 `rg "metadata" apps/ui/src/hooks/mediaMetadata` 调用点

**Interfaces:**
- Produces: `getMetadataRoute`, `createMetadataRoute`, `setMetadataRoute`, `deleteMetadataRoute`(200 `{data}` | 400/404/409/500 problem+json, 跳过 validator 保 wire), `folderMetadataRoute`, `renameFilesInMediaMetadataRoute`(200 `{data}|{error}`)

- [x] **Step 1-6: 按「标准迁移模式」逐个文件执行**(每完成一个路由跑一次 `pnpm --filter server test <文件名>`)。
- [x] **Step 7: 组验证**

```bash
pnpm --filter server typecheck && pnpm --filter server test
(cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip
```

- [x] **Step 8: Commit**

```bash
git add apps/server/src/route apps/server/app.ts apps/server/server.ts apps/ui/src
git commit -m "refactor: migrate metadata routes to Hono RPC"
```

---

## Task 6: 分组迁移 B — 识别/重命名/计划 ✅ (commit 347a81d9)

**Files:**
- server: `RecognizeFolder.ts`, `Scrape.ts`, `TryToRecognizeEpisodes.ts`, `RecognizeEpisodesPlan.ts`, `RenameEpisodeFile.ts`, `RenameEpisodesPlan.ts`, `validateRenameOperations.ts`, `ListDrives.ts`, `ai.ts`, `execute.ts`(`/api/execute`, Task 1 已删除其命令式注册, 本任务以 route module 恢复进 `.route()` 链)
- ui: `src/api/scrape.ts`, `src/api/createRecognizeEpisodePlan.ts`, `src/api/applyPlan.ts` 等(rg 定位; 调用 core-routes path 的文件跳过)

**Interfaces:**
- Produces: `recognizeFolderRoute`, `scrapeRoute`, `tryToRecognizeEpisodesRoute`, `recognizeEpisodesPlanRoute`, `renameEpisodeFileRoute`, `renameEpisodesPlanRoute`, `validateRenameOperationsRoute`, `listDrivesRoute`, `matchMediaFilesToEpisodeRoute`, `executeRoute`

- [x] **Step 1-N: 按「标准迁移模式」逐个文件执行**, 其中 `execute.ts` 保持现有 `executeRequestSchema` zod 校验, 换为 `validator('json', ...)`。
- [x] **Step N+1: 组验证 + Commit**

```bash
pnpm --filter server typecheck && pnpm --filter server test && (cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip
git commit -m "refactor: migrate recognize/rename/plan routes to Hono RPC"
```

---

## Task 7: 分组迁移 C — 媒体库 ✅ (commit 220019b0)

**Files:**
- server: `ImportFolder.ts`, `ImportLibrary.ts`, `UnimportFolder.ts`, `SetWatchedFolder.ts`, `ShowFolder.ts`, `OpenFile.ts`, `OpenInFileManager.ts`, `MoveFileToTrash.ts`
- ui: `src/api/importFolder.ts`, `importLibrary.ts`, `moveFileToTrash.ts`, `openFile.ts`, `openInFileManager.ts` 等调用点

**Interfaces:**
- Produces: `importFolderRoute`, `importLibraryRoute`, `unimportFolderRoute`, `setWatchedFolderRoute`, `showFolderRoute`, `openFileRoute`, `openInFileManagerRoute`, `moveFileToTrashRoute`

- [x] **Step 1-N: 按「标准迁移模式」执行。**
- [x] **Step N+1: 组验证 + Commit**

```bash
pnpm --filter server typecheck && pnpm --filter server test && (cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip
git commit -m "refactor: migrate media library routes to Hono RPC"
```

---

## Task 8: 分组迁移 D — 任务与命令状态 ✅ (commit f9dd22a1)

**Files:**
- server: `GetJob.ts`, `StopJob.ts`, `GetJobLog.ts`, `commandLog.ts`(**注意: 成功 200 返回 `c.body(Uint8Array)` 非 JSON 文本体, 错误才是 JSON — 客户端用标准模式第 5 步的非 JSON 变体, 勿用 unwrapJson+判别联合模板**)
- ui: `src/api/getJob.ts`, `getJobLog.ts`, `src/lib/commandLogTerminal.ts` 调用点

**Interfaces:**
- Produces: `getJobRoute`, `stopJobRoute`, `getJobLogRoute`, `commandLogRoute`

- [x] **Step 1-N: 按「标准迁移模式」执行。**(`commandLog.ts` 参照 Task 4 的路径参数写法)
- [x] **Step N+1: 组验证 + Commit**

```bash
pnpm --filter server typecheck && pnpm --filter server test && (cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip
git commit -m "refactor: migrate job routes to Hono RPC"
```

---

## Task 9: 分组迁移 E — 外部 API 与工具 ✅ (commit c4d2879c)

**Files:**
- server: `Tmdb.ts`, `Tvdb.ts`, `CoreFetch.ts`, `discoverExecutables.ts`, `speedtest.ts`, `shutdown.ts`, `tencentAsr/Transcribe.ts`
- ui: `src/api/tmdb.ts`, `tvdb.ts`, `discoverExecutables.ts` 等调用点

**Interfaces:**
- Produces: `tmdbRoute`, `tvdbRoute`, `coreFetchRoute`, `discoverExecutablesRoute`, `speedtestRoute`, `shutdownRoute`, `tencentAsrTranscribeRoute`

- [x] **Step 1-N: 按「标准迁移模式」执行。**
- [x] **Step N+1: 组验证 + Commit**

```bash
pnpm --filter server typecheck && pnpm --filter server test && (cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit) # 真实 ui 门禁; `pnpm --filter ui typecheck` 是空跑(solution tsconfig files:[]), 勿用 && pnpm knip
git commit -m "refactor: migrate external api routes to Hono RPC"
```

---

## Task 10: 分组迁移 F — debug 路由 ✅ (commit 1a887a15)

**Files:**
- server: `debug/` 下 11 个文件(`debugRecognizeTask.ts`, `debugCreateRenameEpisodePlan.ts`, `debugGetApplicationContext.ts`, `debugGetMediaMetadata.ts`, `debugRenameFolderTool.ts`, `debugScrapeTool.ts`, `debugGetJobTool.ts`, `debugListFilesTool.ts`, `debugGetMediaFolders.ts`, `debugGetEpisodesTool.ts`, `debugIsFolderExistTool.ts`)与 `Debug.ts`
- ui: 无(纯服务端)

- [x] **Step 1-N: 按「标准迁移模式」执行**; 无 UI 调用点, 仅步骤 1-4。
- [x] **Step N+1: 组验证 + Commit**

```bash
pnpm --filter server typecheck && pnpm --filter server test && pnpm knip
git commit -m "refactor(server): migrate debug routes to Hono RPC"
```

---

## Task 11: 收尾 — 清理、文档与全量验证 ✅ (commits 01824894 + 62912fd3 + 612568f5)

**Files:**
- Modify: `AGENTS.md`(「前后端通信」一节补充 Hono RPC 说明与 Out of scope 端点清单)
- Modify: `docs/api/index.md`(注明 Hono 路由的类型契约由 `apps/server/app.ts` 的 `AppType` 提供)
- 检查: `rg "handleGetFolders|handleImportFolder" apps/server --include="*.ts"` 确认无残留旧 import
- 清理孤儿类型: `packages/types/types.ts` 的 `RenameFilesInMediaMetadataResponseBody`(:1170)与 `MetadataSuccessResponseBody`(:897, 若 e2e 的 metadata-http.ts 已不用)为迁移后无消费者的旧定义, knip 不追踪 types.ts 导出, 需手工删除
- Task 10 审查增补: (a) 测试补钉: debugGetJobTool/debugScrapeTool 各补 validation-failure 用例 (`{}` → `Validation failed:`); debugRecognizeTask 补 data-含-error 形状钉子 (`mockResolvedValue({taskId: undefined, error: 'x'})` → `{success:false, data:{error:'x'}, error:'x'}`); 可选 Debug.test.ts 补 cleanUp 分支; (b) **文档化 debug wire 契约** (AGENTS.md/docs/api/index.md): debug 组宽联合 `{success; data?; error?}` + 200 带内错误, 判别用 `success` truthiness 而非 `'error' in body` (后者对非联合形状静默无操作); data-含-error 族 (getJobTool/scrapeTool/renameFolderTool/recognizeTask) 与 error-剥离族 (getMediaMetadata/listFiles/getEpisodes/getMediaFolders) 的分界写明; (c) 完成标准加认可例外: debug 组 12 个宽联合按 catch-all wire 原样保留, 是选择而非必需
- Task 9 审查 Minor 遗留: (a) `shutdown.ts:22-47`、`tencentAsr/Transcribe.ts:36-57` 删包装后残留 4 空格缩进, 统一 reindent (server 无 format 门禁); (b) discoverExecutables/speedtest/Transcribe 的分号/引号风格混血, 统一或决策给 apps/server 引入格式化器; (c) `Tmdb*HttpResponseBody`×3、`Tvdb*HttpResponseBody`×4、`CoreFetchResponseBody`、`DiscoverExecutablesResponseBody` 导出但零外部导入者 — 去 export 或统一决策「响应类型是否公共契约」; (d) `apps/ui/src/api/discoverExecutables.ts:7-9` 对单成员联合的 `Exclude` 是 no-op, 改 `DiscoverExecutablesResponseBody['data']`; (e) `docs/dev/network-core.md:17` BrowserNetworkPort 描述更新为经 rpc; (f) Transcribe 是最后一个非判别响应 (`{success?; error?}`), 零 hc 消费者暂保留, 有消费者时收紧; (g) 可选: Tmdb 响应类型统一为 Core 派生 (与 Tvdb 风格一致)
- Task 8 审查 Minor 遗留: (a) `apps/server/src/route/commandLog.test.ts` 补两条边界钉子: `?offset=abc&limit=xyz` → 200 全量切片 + offset 0; offset 超 EOF → 空体 + `X-Log-Read-Limit: 0`; (b) `apps/ui/src/ai/tools/GetJob.tsx:27` 的既有 `body.data as JobToolPayload` cast 对 ImportLibraryJob/fallback 臂是运行时谎言 (迁移前即如此) — 用 `Extract<SerializedJob, {kind}>` 系收敛或至少留档; (c) 可选: `apps/ui/src/api/commandLog.ts:48-49` 两步条件装配 query 可简化为一步 (hc 的 buildSearchParams 跳过 undefined); (d) 可选: `apps/ui/src/api/getJob.ts:30` 的 `as Job` cast 可用 `Extract<SerializedJob, { kind: string } | { type: 'import-library' }>` 零 cast 收敛
- Task 7 审查 Minor 遗留: (a) `apps/ui/src/api/openInFileManager.ts:67-71` 的 `if (!resp.ok)` 两分支已相同, 折叠为单个 `return await resp.json()` (400-body-as-data 契约注释可留一句); (b) `apps/server/src/route/OpenInFileManager.ts` 四处补显式 `c.json<OpenInFileManagerResponseBody>` 泛型 (8 路由中唯一缺口, 纯一致性); (c) 全部 50+ 路由迁完后统一 sweep 双重 `!ok` 检查 (手写 throw + unwrapJson 并存的文件); (d) openInFileManager 补一条 malformed-JSON→500 现状钉子测试 (与 OpenFile 的 200 in-band 对照)

- [x] **Step 1: 确认 server.ts 已无任何 `handleXxx` import/调用**(Task 10 完成后, 全部路由应已迁移)。

```bash
rg "handle[A-Z]" apps/server/server.ts
```

Expected: 仅剩 `handleProxyRequest` 等非路由工具引用。(实测仅剩 handleExecuteCmd/handleLog/handleProxyRequest, 全部 Out of scope)

- [x] **Step 2: 文档更新**(AGENTS.md 与 docs/api/index.md 按上述内容补充; 另更新 docs/dev/network-core.md:17 BrowserNetworkPort 经 rpc)。

- [x] **Step 3: 移除 knip.json 中临时的 `apps/server` entry `app.ts`**(Task 1 时 `AppType` 尚无消费者而临时添加; 全部路由迁移完成后由 `.route()` 链消费)。移除后运行 `pnpm knip` 确认仍为绿。

- [x] **Step 4: 全量 Pre Commit 验证**

```bash
pnpm knip
pnpm typecheck
pnpm build
pnpm test
```

Expected: 全部通过。若有 e2e 环境, 追加冒烟: `pnpm --filter e2e test`(wire 协议未变, 应全绿)。

- [x] **Step 5: Commit**

```bash
git add AGENTS.md docs/api/index.md
git commit -m "docs: document Hono RPC client contract for ui/server HTTP"
```

---

## 风险与对策

| 风险 | 对策 |
|---|---|
| ui typecheck 引入 server 类型导致编译变慢或 bun 类型报错 | app.ts 严禁引入 `serveStatic`(`hono/bun`)与 bun 类型; 静态服务/代理/notFound 留在 server.ts 命令式注册。app.ts 已通过依赖注入 logger(`CreateAppDeps.logger: CoreRoutesLogger`, 不 import `./lib/logger`)避免 `@server/*` alias 泄漏进 ui 类型图; 若 ui typecheck 仍报 `@smm/core-routes` 无法解析, 在 ui 增加该 workspace 依赖或 paths 映射。若仍出现解析问题, 回退方案: 将 `AppType` 抽到独立轻量模块或生成 `.d.ts` |
| `validator('json')` 改变无效请求的响应(原 200 error → 400 details) | 仅影响非法请求; UI 均发送合法 body, e2e 不受影响。如个别路由依赖原行为, 该路由跳过 validator, 保持手工解析 |
| 判别联合 `{ data } \| { error }` 与既有 UI 分支逻辑不一致 | 逐调用点适配(Task 3 Step 6 模式); 类型检查会强制暴露所有遗漏 |
| `/api/rename-folder` 同时存在于 core-routes 与 Hono | core-routes 优先分发, Hono 版本实际不可达; 该 Hono 路由不迁移、保持原状 |
| 迁移期间 `/api/execute` 短暂不可用(Task 1 Step 3 到 Task 6) | 如期间需跑依赖它的 e2e, 保留 `registerExecuteRoutes(this.app)` 行直至 Task 6 |
| knip 误报新旧类型 | 旧 interface 随文件替换一并删除; 分组 commit 后单独 `pnpm knip` 检查 |

## 完成标准

- `apps/server/server.ts` 无 `handleXxx` 路由注册残留; 所有 Hono 路由经 `.route()` 组合进 `createApp`
- `apps/ui` 中所有 in-scope 端点经 `rpc` client 调用, 无手写 `ResponseBody` interface (认可例外: `api/listDrives.ts` 的宽联合 `ListDrivesResponseBody` 按 catch-all wire 原样保留 — 这是选择而非必需, rpc 推导在此也可行; 审计时勿误报)
- `pnpm knip && pnpm typecheck && pnpm build && pnpm test` 全绿
- 新增 Hono 路由只需: 新建 route module → 加入 app.ts 链 → UI 直接获得类型(新同事入职无需理解自研类型方案)
