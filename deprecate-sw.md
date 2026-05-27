# Service Worker 弃用可行性分析

## 1. 当前 Service Worker 架构概览

当前架构涉及 **4 层**：

```
UI Thread (React)          Service Worker          CLI Backend (Hono/Bun)
┌─────────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ JobOrchestrator      │    │ download-service- │    │ /api/executeCmd      │
│ Provider.tsx          │◄──►│ worker.js         │───►│   (streaming NDJSON) │
│                       │    │                    │    │                      │
│ downloadTaskDb.ts     │    │ IndexedDB          │    │                      │
│   (IDB read/write)    │    │   (IDB read/write) │    │                      │
└─────────────────────┘    └──────────────────┘    └──────────────────────┘
```

### 1.1 文件清单

| 文件 | 作用 |
|------|------|
| `apps/ui/public/download-service-worker.js` | SW 主脚本 (~900 行)。处理 download/transcribe/translate/synthesize/process 五种任务的执行 |
| `apps/ui/public/whitelisted-cmd-sw.js` | SW 的辅助模块 (~210 行)。通过 `importScripts` 加载，提供 `executeCmdViaFetch` 和各类参数构建函数 |
| `apps/ui/src/lib/downloadServiceWorker.ts` | 主线程侧 SW 注册与更新检查 (~55 行) |
| `apps/ui/src/components/JobOrchestratorProvider.tsx` | 主线程侧任务编排器 (~400 行)。负责 SW 注册、IDB 同步、postMessage 通信 |
| `apps/ui/src/lib/downloadTaskDb.ts` | IndexedDB 操作层，主线程读写 |

### 1.2 SW 承担的任务

| 任务类型 | SW 事件 | 实际执行操作 |
|---------|---------|-------------|
| `download-video` | `download:start/stop/remove` | 调用 `/api/executeCmd` 执行 `yt-dlp` 下载，流式读取 NDJSON |
| `transcribe` | `transcribe:start/stop/remove` | 调用 `/api/executeCmd` 执行 `videocaptioner transcribe` |
| `translate` | `translate:start/stop/remove` | 调用 `/api/executeCmd` 执行 `videocaptioner subtitle` |
| `synthesize` | `synthesize:start/stop/remove` | 调用 `/api/executeCmd` 执行 `videocaptioner synthesize` |
| `process` | `process:start/stop/remove` | 调用 `/api/executeCmd` 执行 `videocaptioner process` |
| SW 生命周期 | `activate` | 将所有 running 任务标记为 stopped |
| 心跳 | `*:heartbeat` | 每 20s 通知 UI 线程 |

### 1.3 通信协议

```
UI Thread → SW:  navigator.serviceWorker.controller.postMessage({ event, id })
SW → UI Thread:  clients.matchAll().forEach(c => c.postMessage({ event, ...args }))
共享状态:        IndexedDB 'DownloadTaskDatabase' / 'jobs' store (双方读写)
```

---

## 2. SW 承担的关键功能与替代方案

### 2.1 后台长期运行 (最主要功能)

**SW 做什么**：当 yt-dlp 下载 1 小时的视频，或 videocaptioner 转写 30 分钟音频时，SW 在后台持续通过 `fetch('/api/executeCmd')` 流式读取 CLI 的 NDJSON 输出，并将进度写回 IDB。

**为什么选择 SW**：SW 独立于页面生命周期，即使页面刷新或关闭，下载仍继续。

**替代方案**：
- **主线程直接 fetch**：Electron 环境是 SPA，不存在传统页面导航。组件卸载时 fetch 仍在进行（Promise 未释放）。页面刷新会导致 fetch 中断，但可结合现有的 **reconciliation 机制** 恢复。
- **现有 reconciliation 机制**：`apps/ui/src/lib/commandExecutionStatusPoller.ts` 已经在主线程上轮询 CLI 后端的执行状态（`/api/commandExecutionStatus`），可将页面刷新后丢失的任务恢复为 stopped/failed。

**结论**：主线程可以承担。页面刷新场景通过 reconciliation 覆盖。

### 2.2 心跳通知

**SW 做什么**：每 20 秒向 UI 线程发送心跳，用于状态栏展示"运行中"标识。

**替代方案**：主线程直接轮询 IDB 或 CLI 状态即可，无需 SW。

### 2.3 SW 重新激活时标记 running 任务

**SW 做什么**：当新版本 SW 激活时，将 IDB 中所有 `running` 任务改为 `stopped`。

**替代方案**：页面加载时在 `JobOrchestratorProvider` 中执行相同逻辑（`handleSwReactivate` 已有等效实现）。

### 2.4 命令执行 (executeCmdViaFetch)

**SW 做什么**：在 `whitelisted-cmd-sw.js` 中实现了一个 `executeCmdViaFetch` 函数，通过 `fetch('/api/executeCmd')` 流式读取 NDJSON，解析 stdout/stderr 和 system 事件。

**代码位置**：`apps/ui/public/whitelisted-cmd-sw.js` (~110 行)

**替代方案**：主线程已有功能完全等价的实现：
- `apps/ui/src/lib/whitelistedCmd/executeCmdToCompletion.ts` — `executeCmdToCompletion()` 
- `apps/ui/src/lib/whitelistedCmd/executeCmdToCompletion.ts` — `executeCmdToCompletionWithHeaders()`（支持 `X-Command-Execution-Id`）

两者都通过 fetch + 流式读取 NDJSON 实现，功能重复。

### 2.5 参数构建函数

**SW 做什么**：`whitelisted-cmd-sw.js` 中定义了 `buildYtdlpDownloadArgs`, `buildVcTranscribeArgs`, `buildVcTranslateArgs`, `buildVcSynthesizeArgs`, `buildVcProcessArgs`。

**替代方案**：这些函数在主线程侧有等价的 TypeScript 实现：
- `apps/ui/src/api/ytdlp.ts` — `listYtdlpFormats()` 内部已有 `buildYtdlpDownloadArgs` 的使用
- `apps/ui/src/lib/downloadVideoJobFactory.ts` — `buildDownloadVideoJob()` 构建 download job data
- CLI 端 `apps/cli/src/route/executeCmd.ts` 直接执行命令，不依赖 SW。

---

## 3. 架构问题分析

### 3.1 代码重复

以下功能在三个地方有冗余实现：

| 功能 | SW 实现 | 主线程实现 |
|------|---------|-----------|
| `executeCmdViaFetch` (流式 NDJSON) | `whitelisted-cmd-sw.js` | `executeCmdToCompletion.ts` |
| `buildYtdlpDownloadArgs` | `whitelisted-cmd-sw.js` | `downloadVideoJobFactory.ts` + `ytdlp.ts` |
| `parseYtdlpDownloadStdout` | `whitelisted-cmd-sw.js` | `ytdlp.ts` |
| `buildVc*Args` 系列 | `whitelisted-cmd-sw.js` | 参数直接内联在 `useYtdlpDownloadFlow.ts` 等 |

每次修改这些逻辑需要在两个/三个地方同步更新。

### 3.2 SW 使用 JavaScript (非 TypeScript)

`download-service-worker.js` 和 `whitelisted-cmd-sw.js` 是纯 JS 文件，没有类型检查。这意味着：
- 重构时 IDE 无法提供类型提示
- 运行时可出现 `undefined is not a function` 错误
- 测试覆盖困难（无法用 Vitest 直接测试 SW 内的函数）

### 3.3 复杂的双向通信

```
UI → IDB → SW     (SW 从 IDB 读取 job 数据)
SW → IDB → UI     (SW 写回 job 状态变更)
SW → postMessage → UI  (异步事件通知)
UI → postMessage → SW  (启动/停止命令)
```

IDB 作为双方共享的状态存储，存在竞态条件风险。例如 `JobOrchestratorProvider.tsx` 中有一个串行化队列 `syncFromIndexedDBChain` 来规避并行读写问题。

### 3.4 SW 更新逻辑

`downloadServiceWorker.ts` 中有完整的 SW 版本更新检查逻辑（每 1 小时检查更新，focus 时检查，`controllerchange` 监听）。但这些在 Electron 环境中几乎不会触发（非 Web 部署场景）。

### 3.5 SW `importScripts` 缓存问题

```js
const WHITELISTED_CMD_SW_REV = 7
importScripts(`/whitelisted-cmd-sw.js?rev=${WHITELISTED_CMD_SW_REV}`)
```

需要手动 bump `WHITELISTED_CMD_SW_REV` 来绕过 SW 的缓存。这是一个容易忘记的维护负担。

---

## 4. 移除 SW 的可行性

### 4.1 结论：可以完全移除

SW 在当前 Electron + SPA 架构中不是必需的。五大任务类型都可以通过主线程直接执行：

| 功能 | 当前路径 | 移除后路径 |
|------|---------|-----------|
| 执行长期命令 | SW → `fetch /api/executeCmd` | 主线程 → `executeCmdToCompletion` |
| IDB 持久化 | SW 和 UI 线程双写 | 仅 UI 线程读写 |
| 任务编排队列 | SW 内部循环 + IDB | 主线程 JS 循环 + IDB |
| 心跳/进度 | SW → postMessage → UI | 主线程定时器 + IDB |
| 命令恢复 | reconciliation poller (已有) | 继续使用现有 reconciliation |

### 4.2 唯一需要关注的风险

**页面刷新导致正在运行的 fetch 中断**：

当前 SW 能幸存的场景：
1. 用户按 F5 刷新页面
2. Electron 窗口 reload
3. 开发时 Vite HMR

在这些情况下，SW 中的 `fetch` 不受影响，命令继续在 CLI 后端运行。

移除 SW 后，页面刷新会导致主线程的 `fetch` 被取消。但：
- **CLI 后端不会停止执行**（Bun 进程独立）
- **现有 reconciliation 机制**会通过 `pollCommandExecutionStatusAndReconcile` 检测到命令已结束，并将 IDB 任务标记为 `succeeded` 或 `failed`
- 唯一的损失是：刷新后任务被标记为 `aborted`，用户需要手动重新触发

**缓解方案**：
- Electron 中可以禁用页面刷新或拦截 `beforeunload` 提示用户
- reconciliation 已经能覆盖大部分场景

---

## 5. 建议的移除方案

### 5.1 移除清单

```
待移除文件:
  apps/ui/public/download-service-worker.js        (~900 行)
  apps/ui/public/whitelisted-cmd-sw.js              (~210 行)
  apps/ui/src/lib/downloadServiceWorker.ts          (~55 行)
  apps/ui/src/lib/downloadServiceWorker.test.ts     (~35 行)

待修改文件:
  apps/ui/src/components/JobOrchestratorProvider.tsx
    - 移除 SW 注册逻辑 (navigator.serviceWorker.register)
    - 移除 postSw() 和相关 SW 消息监听
    - 移除 attachDownloadServiceWorkerUpdateChecks
    - 保留 IDB 操作和 reconciliation

  apps/ui/src/lib/downloadVideoJobFactory.ts
    - buildDownloadVideoJob 中通过 processJob() 直接调用 executeCmdToCompletion
      或在新模块中实现任务执行循环
```

### 5.2 新增模块建议

```
apps/ui/src/lib/backgroundJobRunner.ts   (新建)
  - 任务执行循环 (从 IDB 取 pending job → 执行 → 更新 IDB)
  - 单类型单文件夹并发控制 (复用现有 autoStart 逻辑)
  - 中止控制 (AbortController 映射)
  - 进度报告 (直接更新 Zustand store)
```

### 5.3 复杂度估算

| 维度 | 当前 (SW) | 移除后 |
|------|----------|--------|
| 运行时代码行数 | ~1200 JS + ~450 TS | ~300 TS (新 runner) |
| 需要同步的逻辑 | 3 处 (SW / UI / CLI) | 2 处 (UI / CLI) |
| 调试能力 | 需开 DevTools → Application → Service Workers | 标准 React DevTools |
| 类型安全 | SW 侧无类型 | 全链路 TypeScript |
| 页面刷新后的任务恢复 | SW 自动继续 | reconciliation 恢复（最终一致） |

### 5.4 迁移步骤

1. **Phase 1**：实现 `backgroundJobRunner.ts`，在主线程直接执行任务
2. **Phase 2**：移除 `JobOrchestratorProvider` 中的 SW 注册和相关代码
3. **Phase 3**：删除 `download-service-worker.js`、`whitelisted-cmd-sw.js` 及相关文件
4. **Phase 4**：加强 reconciliation，确保刷新后任务状态正确恢复

---

## 6. 总结

Service Worker 的设计初衷是为了在**浏览器 Tab 关闭后**仍能继续后台任务，这是 PWA 的标准模式。但在 **Electron 桌面应用**中：

- 没有真正的"关闭 Tab"场景（SPA 路由切换不触发页面卸载）
- CLI 后端是独立进程，前端只是一个控制面板
- 现有的 reconciliation 机制已经能处理命令状态的恢复

因此，SW 层引入的复杂性（代码重复、双向通信、类型缺失、缓存管理）远大于其带来的价值。**建议移除 Service Worker，简化为单线程架构。**
