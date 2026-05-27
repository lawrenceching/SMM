# LogDialog 设计文档

## 1. 背景与目标

`apps/cli` 通过白名单命令运行外部 CLI（`ffmpeg` / `ffprobe` / `yt-dlp` / `videocaptioner`）。当前已实现：

- 每次执行都会生成一个 UUID 形式的 `executionId`，并把 stdout / stderr / 系统注解写到 `<LOG_DIR>/commands/<executionId>/main.log`（见 `apps/cli/src/route/commandExecutionLog.ts`）。
- 流式 API `POST /api/executeCmd` 通过响应头 `X-Command-Execution-Id` 与 `X-Command-Log-Path` 把这一信息返回前端。
- 字幕相关 API（`/api/videocaptioner/{transcribe,translate,synthesize,process}`）走 `runWhitelistedCommandSync`，同样生成 `executionId` 并落盘，但**目前并未把 `executionId` 暴露给调用方（Service Worker）**。
- `BackgroundJobsPopover` 已经能展示任务的状态（pending / running / succeeded / failed / aborted）与进度。

目标是：在 `BackgroundJobsPopover` 的每一行字幕任务上提供"日志"按钮，点击后弹出 `LogDialog`，呈现该任务对应 `executionId` 的命令执行日志，便于诊断"任务失败/挂起/输出异常"等问题。

## 2. 范围与非目标

### 范围

- 字幕相关任务：`transcribe`、`translate`、`synthesize`、`process`（均经 `runWhitelistedCommandSync` 调用 `videocaptioner`）。
- `BackgroundJobs` 列表中"日志"入口的呈现与可见性规则。
- 新的"读取命令日志"后端只读接口。
- 新的 `LogDialog` 组件、`useDialogs()` 集成、数据获取与渲染策略。
- 从 CLI → API → Service Worker → IndexedDB → UI 全链路打通 `executionId` 的载荷传递。

### 非目标

- 不修改 `POST /api/executeCmd` 的 NDJSON 流式协议。
- 不重构 `ExecuteCmdDialog`（开发调试用），但 LogDialog 在视觉与交互上对齐其日志面板。
- 不为 `download-video` 任务（yt-dlp）提供日志按钮；该类型与字幕任务的执行链不同，可在后续扩展中纳入。
- 不实现历史日志检索 / 全文搜索 / 跨任务聚合视图。
- 不主动清理或滚动 `commands/<uuid>/main.log`；交由 `LOG_DIR` 的运维策略（独立工作流）。

## 3. 关键术语

| 术语 | 含义 |
| --- | --- |
| `executionId` | 一次 CLI 调用的 UUID；与磁盘日志目录名一一对应。 |
| 命令日志 | 落盘文件 `<LOG_DIR>/commands/<executionId>/main.log` 的内容。 |
| 任务（Job） | `TaskJobRecord` / `BackgroundJob`，由前端 `useJobManager` + Service Worker 编排。 |
| 字幕任务 | type 为 `transcribe` / `translate` / `synthesize` / `process` 的 Job。 |

## 4. 现状分析

```mermaid
flowchart LR
  subgraph UI[UI Thread]
    Dlg[字幕对话框]
    Mgr[useJobManager]
    Pop[BackgroundJobsPopover]
    Store[backgroundJobsStore]
    Obs[IndexedDbObserver]
  end
  subgraph IDB[(IndexedDB jobs)]
    REC[TaskJobRecord]
  end
  subgraph SW[Service Worker]
    Start[start*]
  end
  subgraph CLI[apps/cli]
    Route[/api/videocaptioner/*/]
    Sync[runWhitelistedCommandSync]
    LogWriter[createCommandExecutionLogWriter]
    Disk[(commands/&lt;uuid&gt;/main.log)]
  end

  Dlg --> REC
  Mgr -->|postMessage *:start| Start
  Start -->|fetch POST| Route
  Route --> Sync
  Sync --> LogWriter --> Disk
  Sync -->|{success?,error?}| Route
  Route -->|JSON| Start
  Start --> REC
  REC --> Obs --> Store --> Pop
```

**关键缺口**：

1. `runWhitelistedCommandSync` 内部已知 `executionId`，但其返回类型 `VideoCaptionerTranscribeResult` 仅含 `{ success?, error? }`，未向上游传递。
2. `/api/videocaptioner/*` 路由把上述结果直接 `c.json(...)` 返回，没有把 `executionId` 透传出去。
3. Service Worker 仅消费 `body.error`，未持有 `executionId`。
4. `TaskJobRecord` / `BackgroundJob*Data` 没有承载 `executionId` 的字段。
5. 没有"按 `executionId` 读取命令日志"的对外 API。
6. `BackgroundJobsPopover` 没有"日志"按钮，也没有任何弹窗钩子。
7. `dialog-provider.tsx` 未注册 `LogDialog`。

## 5. 总体方案

### 5.1 解决思路

围绕 `executionId` 建立从后端到 UI 的一条贯通链路，并在前端增加只读视图。原则：

- **复用已有落盘日志**，不引入新的日志存储。
- **后端只读 + 路径校验**，确保日志路径仅在 `<LOG_DIR>/commands/<uuid>/` 范围内。
- **乐观 UI**：按钮可用性由 `executionId` 是否已落到任务记录上决定；缺失即隐藏或禁用并提示。
- **统一弹窗机制**：通过 `useDialogs()` 注册新的 `LogDialog`，避免散点的 dialog 状态管理。

### 5.2 端到端数据流

```mermaid
sequenceDiagram
  participant Dlg as 字幕对话框
  participant IDB as IndexedDB
  participant SW as ServiceWorker
  participant API as /api/videocaptioner/*
  participant CLI as runWhitelistedCommandSync
  participant Disk as commands/&lt;id&gt;/main.log
  participant Pop as BackgroundJobsPopover
  participant Log as LogDialog
  participant LogAPI as /api/command-log/&lt;id&gt;

  Dlg->>IDB: saveJob(status=pending)
  SW->>API: POST videocaptioner/*
  API->>CLI: 调用
  CLI->>Disk: 写 stdout/stderr/system
  CLI-->>API: { success, executionId, logRelativePath }
  API-->>SW: 200 JSON 含 executionId
  SW->>IDB: dbPutJob({ data: { ...executionId } })
  IDB-->>Pop: 同步到 backgroundJobsStore
  Pop->>Log: 用户点击"日志"按钮
  Log->>LogAPI: GET 按 executionId
  LogAPI->>Disk: 读取 main.log
  LogAPI-->>Log: 文本 / 分段
  Log->>Log: 渲染、滚动、复制、刷新
```

## 6. 模块设计

### 6.1 CLI 侧：透出 `executionId`

| 模块 | 变化 |
| --- | --- |
| `runWhitelistedCommandSync` | 返回值新增 `executionId` 与 `logRelativePath`；同步路径已有这两个值，仅作"上抛"，不影响外部行为。`VideoCaptionerTranscribeResult` 拓展为包含这两个可选字段（保持向后兼容）。 |
| `/api/videocaptioner/transcribe` | 200 与 400 JSON 响应均附带 `executionId` 与 `logRelativePath`。`error` 场景同样需要 ID，以便用户查看失败日志。 |
| `/api/videocaptioner/translate` | 同上。 |
| `/api/videocaptioner/synthesize` | 同上。 |
| `/api/videocaptioner/process` | 同上。 |
| 新增 `GET /api/command-log/:executionId` | 详见 6.2。 |

> 注：流式 `POST /api/executeCmd` 已通过响应头返回 ID，本次保持不变。

### 6.2 新增后端 API：读取命令日志

| 端点 | `GET /api/command-log/:executionId` |
| --- | --- |
| 路径参数 | `executionId`：UUID v4 形式，正则严格匹配；非法字符直接 400，杜绝路径穿越。 |
| 查询参数 | `offset` / `limit`（字节级，可选；用于分段拉取）；`format=raw|segments`（默认 `raw`）。 |
| 响应（raw） | `text/plain; charset=utf-8`，原样返回 `main.log`。`Content-Length`、`X-Log-Size`、`X-Log-Truncated` 用于前端判断是否已截断。 |
| 响应（segments） | `application/json`：将文件按 `--- stream=stdout|stderr|system ts=... ---` 头切分为有序段，每段含 `kind`、`ts`、`text`。 |
| 错误 | 400（格式非法）、404（日志目录或文件不存在）、500（IO 失败）。 |
| 限制 | 单次响应最大 N MB（建议 2 MB），超出则 `X-Log-Truncated: true` 并从尾部回退到段边界。 |
| 安全 | 仅允许在 `<LOG_DIR>/commands/<executionId>/main.log` 下读取；`getLogDir()` 之外的路径绝对拒绝。 |

> 写入侧无需改造，仍由 `createCommandExecutionLogWriter` 负责。

### 6.3 前端：贯通 `executionId`

| 模块 | 变化 |
| --- | --- |
| `types/background-jobs.ts` | `TranscribeBackgroundJobData` / `TranslateBackgroundJobData` / `SynthesizeBackgroundJobData` / `ProcessBackgroundJobData` 均新增可选 `executionId`、`logRelativePath`。 |
| `apps/ui/public/download-service-worker.js` | 字幕任务的 `startTranscribe` / `startTranslate` / `startSynthesize` / `startProcess` 在 `parseApiResponseBody` 之后，把 `executionId` 与 `logRelativePath` 写回 `job.data`，并 `dbPutJob` 持久化；时机在状态变更为 `running` → 终态前的任意一次落库即可，最稳妥的位置是收到响应后立即持久化一次，再在终态时再次落库。 |
| `IndexedDbObserver.tsx` | `jobRecordToBackgroundJob` 解析 `data.executionId` / `data.logRelativePath` 注入到对应类型的 `BackgroundJob` 上。 |
| `backgroundJobsStore.ts` | 无逻辑变化，仅类型扩展。 |

### 6.4 前端：BackgroundJobs 日志入口

`BackgroundJobsPopover.tsx` 行级布局新增"日志"按钮：

- 可见性：当 `job` 类型为字幕任务（transcribe/translate/synthesize/process）**且** `job.data.executionId` 存在时显示；否则不渲染或灰显并提示 "Log not available yet"。
- 状态无关性：`pending`/`running`/`succeeded`/`failed`/`aborted` 均可点击，便于在运行中查看实时输出。
- 与现有按钮（"中止"等）并列，使用 `ghost` 风格 + 文档图标，与状态徽章不冲突。
- 仅触发 `openLogDialog`，不持有日志数据；保持 Popover 轻量。

### 6.5 前端：LogDialog

| 维度 | 设计 |
| --- | --- |
| 注册 | 通过 `useDialogs()` 暴露 `logDialog: [openLog, closeLog]`，由 `DialogProvider` 渲染单例 `LogDialog`，与 `ExecuteCmdDialog` 等保持一致。 |
| Props 模型 | `{ isOpen, onClose, executionId, title, jobStatus?, logRelativePath? }`。`title` 用任务的 `name`，便于用户辨识。 |
| 数据获取 | 使用 TanStack Query（命名 key：`['command-log', executionId, offset]`）调用 `/api/command-log/:executionId`。终态任务结果可较长时间缓存；非终态任务在 dialog 打开期间以低频间隔（约 2–3 秒）轮询一次直至看到 `system event=exit/error/timeout` 段或对应 job 进入终态。 |
| 渲染策略 | 默认 `format=segments` 解析后，按 `stdout` / `stderr` / `system` 三色分块（沿用 `ExecuteCmdDialog` 的色板），并加上时间戳前缀；同时提供"原始文本"切换。 |
| 大日志 | UI 端虚拟滚动；超过截断阈值时显示"已截断，下载完整日志"提示（下载使用同一 API 加 `offset/limit` 拼接）。 |
| 操作区 | 复制 `executionId`、复制 `logRelativePath`、刷新（手动重抓）、滚动到底、清空（仅前端缓存）、关闭。 |
| 失败态 | 404：显示"该任务尚未生成日志或日志已被清理"；500：显示错误并允许重试；网络中断：使用 query 的内置错误态。 |
| 无障碍 | 标题、关闭按钮、键盘 ESC 关闭；列表使用 `aria-live="polite"`，避免运行中追加内容打扰焦点。 |
| 国际化 | 新增 `dialogs.logDialog.*` 翻译键（en / zh-CN / zh-HK / zh-TW），与现有 `executeCmd` 风格对齐。 |

### 6.6 前端：模块关系

```mermaid
flowchart LR
  Pop[BackgroundJobsPopover] -- openLog --> Provider[DialogProvider]
  Provider --> LogDlg[LogDialog]
  LogDlg -- useQuery --> ApiClient[/lib/api command-log/]
  ApiClient -- HTTP GET --> Backend[/api/command-log/:id/]
  Backend --> Disk[(commands/&lt;id&gt;/main.log)]
  Store[backgroundJobsStore] --> Pop
  Obs[IndexedDbObserver] --> Store
  IDB[(jobs)] --> Obs
  SW[Service Worker] --> IDB
```

## 7. 状态机与时序

任务记录上的 `executionId` 生命周期：

```
pending (无 executionId)
  └─ SW 收到 *:start
       └─ fetch /api/videocaptioner/*
            ├─ 200 → 解析 body.executionId → dbPutJob (running, data.executionId 已写入)
            └─ 4xx/5xx → 仍写入 data.executionId（若返回），状态置 failed
running → succeeded | failed | stopped | aborted
（executionId 一经写入即不可变）
```

LogDialog 与任务终态解耦：只要 `executionId` 已落 IDB，无论任务后续是 succeeded/failed，按钮都可点击。

## 8. 安全与可靠性

- **路径穿越**：`executionId` 仅接受严格的 UUID v4 正则；服务端拼接路径后再 `path.resolve` 并校验前缀必须是 `path.resolve(getLogDir(), 'commands')`。
- **大文件读取**：服务端 `Content-Length` 上限 + `X-Log-Truncated`；超过上限按段边界截断，避免把整文件读入内存。
- **并发 / 写入中读**：`appendFileSync` 与 `readFile` 在 OS 层是安全的；返回快照即可，无需锁。
- **隐私**：命令日志中可能包含路径、API key 片段、错误堆栈。LogDialog 默认仅本地可见，不会上传；后端 API 仅响应本机请求（沿用 `/api/*` 的现有访问模型）。
- **空状态**：日志文件可能尚未生成（请求刚发出但还未触发 `appendFileSync`），返回 404，前端展示等待态。

## 9. 性能

- LogDialog 仅在打开时拉取日志；关闭后释放查询。
- 终态任务的查询结果可缓存（`staleTime` 较长），重复打开秒开。
- 非终态任务采用低频轮询；轮询频率与 UI 响应需求平衡（≤ 0.5 Hz）。
- 大日志使用虚拟滚动避免渲染卡顿。

## 10. 兼容性与迁移

- `TaskJobRecord.data` 中 `executionId` 字段为可选，存量记录无该字段时 LogDialog 按钮不可见——无需迁移脚本。
- `runWhitelistedCommandSync` 返回值新增字段但保持已有字段语义不变，旧调用方（仅消费 `success/error`）不受影响。
- 新 API 与既有 `/api/executeCmd`、`/api/log`（前端日志上报）正交，互不影响。

## 11. 测试策略

- **CLI 单元**：`runWhitelistedCommandSync` 在 stub 子进程下返回包含 `executionId` 的对象；`/api/command-log/:id` 校验 UUID 格式、路径解析、范围裁剪、404、500。
- **SW**：用现有 SW 测试基线 mock fetch，断言成功 / 失败两种响应均把 `executionId` 写入 IDB。
- **UI 单元**：
  - `BackgroundJobsPopover` 在 `executionId` 缺失 / 存在两种 fixture 下按钮的可见性。
  - `LogDialog` 在 query loading / success / 404 / 截断 / 终态/ 运行中 五种状态下的渲染快照。
- **国际化**：四种语言下标题与按钮文案不溢出。
- **E2E（apps/e2e）**：触发一次字幕任务 → 在 Popover 找到日志按钮 → 打开 LogDialog → 断言含 `--- stream=stdout` 头的内容。

## 12. 可观测性

- 后端 `[commandLog]` 日志前缀：读取请求记录 `executionId` 与字节数、是否截断。
- 前端 LogDialog 关闭时上报一次 `frontend log` 含 `executionId`、`durationMs`、最终查询次数，便于诊断"日志总是空"的反馈。

## 13. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| `runWhitelistedCommandSync` 返回值扩展影响其它内部调用方 | 字段为可选，且现有调用方只读 `success/error`；编译期可控。 |
| 字幕路由 4xx 时仍需返回 `executionId` 才能让用户排查失败 | 在路由的 `result.error` 分支也透传 ID。 |
| 命令日志被同名 UUID 复写 | UUID v4 碰撞概率忽略；写入路径含 UUID，互相隔离。 |
| 日志文件被外部工具清理 → LogDialog 404 | 友好的空状态文案；不视作错误。 |
| 长运行任务日志膨胀 | API 截断 + UI 虚拟滚动；后续可加按需"下载完整日志"。 |
| SW 不支持的旧浏览器 | 项目本身依赖 SW，无新增风险。 |

## 14. 工作分解（实施视角，非代码细节）

1. **后端扩展 ExecutionId 透出**
   - 调整 `runWhitelistedCommandSync` 返回结构。
   - 修改 4 个 `/api/videocaptioner/*` 路由的响应序列化。
2. **新增 `/api/command-log/:executionId` 路由**与单元测试。
3. **前端类型与 SW 持久化**
   - 扩展 `background-jobs.ts` 类型。
   - 更新 SW 中字幕任务的 fetch 后处理。
   - 调整 `IndexedDbObserver` 的反序列化。
4. **新增 LogDialog 与 Provider 注册**
   - 新组件、新的 i18n 键、新的 hooks（基于 TanStack Query 与 `/api/command-log`）。
5. **BackgroundJobsPopover 接入**
   - 行级新增按钮；可见性逻辑；交互埋点。
6. **多语言文案**：补充 `en/zh-CN/zh-HK/zh-TW` 的 `logDialog` 键。
7. **测试**：CLI、SW、UI 单测 + 一条 E2E。
8. **文档**：在 `docs/api/index.md` 增加 `/api/command-log/:executionId` 索引，并交叉链接本文档。

## 15. 参考

- `apps/cli/src/route/executeCmd.ts`、`apps/cli/src/route/commandExecutionLog.ts`
- `apps/cli/src/route/videocaptioner/Process.ts` 及兄弟路由
- `apps/ui/public/download-service-worker.js`（字幕任务的 SW 处理段）
- `apps/ui/src/hooks/useJobManager.ts`
- `apps/ui/src/components/background-jobs/BackgroundJobsPopover.tsx`
- `apps/ui/src/components/IndexedDbObserver.tsx`
- `apps/ui/src/providers/dialog-provider.tsx`
- `apps/ui/src/components/dialogs/ExecuteCmdDialog.tsx`（视觉/交互参考）
- `docs/api/ExecuteCmdAPI.md`、`docs/design/transcribe.md`、`docs/design/videocaptioner.md`
