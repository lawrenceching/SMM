# SynthesizeSubtitleJob + ProcessSubtitleJob

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

字幕合成（synthesize）与完整字幕流水线（process）今天仍跑在 UI `JobOrchestratorProvider`：对话框经 IndexedDB 入队，Orchestrator 用 `executeCmd` 调 `videocaptioner synthesize|process`。转写/翻译已迁到 Core（`TranscribeSubtitleJob` / `TranslateSubtitleJob` + `VideoCaptionerPort` + `videocaptioner` 队列）。本设计把剩余两条 VC 路径按同一模式迁到 Core。

Core 已有 `buildVideoCaptionerSynthesizeArgs` / `buildVideoCaptionerProcessArgs`；Server 已注入 `VideoCaptionerPort`，但 adapter 硬编码超时 **10 分钟**，不足以覆盖 synthesize（1h）/ process（2h）。

**Constraints (product decision):**

- Scope: `SynthesizeSubtitleJob` + `ProcessSubtitleJob`；复用 `VideoCaptionerPort` 与 `videocaptioner` 队列；HTTP 入队 + 现有 `get-job` / `get-jobs` / `get-job-log` / `stop-job`；UI 对话框与后台任务切到 Core；CLI `smm synthesize` / `smm process`。
- Process 建模：单个 Job 直接跑 VC `process` 子命令（不拆成 transcribe→translate→synthesize 串联）。
- Queue: 与字幕 Job **共用** `videocaptioner`，并发 **1**；按 Job 类型设置 `timeoutMs`（synthesize 1h，process 2h；既有字幕 Job 仍 10min）。
- Port timeout: Server adapter 必须至少覆盖 **2h**（或按请求/Job 传入），避免长 process 被 Port 先杀掉。
- Out of scope: ffmpeg 相关后台任务；VC 中间进度解析；把 process 拆成多 Core Job。
- Storage: 进程内内存，进程退出即丢。
- Progress: `running` 时 0，成功 100。
- Secrets: process 的 `llm.apiKey` / `apiBase` / `model` 可进 argv，**不得**进入 `toJSON()` 或 UI Zustand 镜像。

## 2. Architecture

### 2.1 Project Level Architecture

```
UI / CLI
  → Core.synthesizeSubtitle / processSubtitle
  → JobManager.submit(…, { queue: "videocaptioner", timeoutMs: 1h | 2h })
  → SynthesizeSubtitleJob | ProcessSubtitleJob
  → VideoCaptionerPort.run({ args, signal, onStdoutLine?, onStderrLine? })
  → apps/server 适配器（runCommand：videocaptioner、命令日志、Abort；timeout ≥ 2h）
```

| 层 | 职责 |
|----|------|
| `apps/core` | Job 类、请求 assert、Core 公开方法；复用现有 argv builders |
| `apps/server` | Port 超时抬升；`POST /api/synthesize-subtitle`、`/api/process-subtitle`；`serializeJob` |
| `apps/cli` | `smm synthesize` / `smm process`（本进程 Core，等终态 exit 0/1） |
| `apps/ui` | 对话框 Core HTTP；Zustand 镜像；删 Orchestrator synthesize/process |
| Orchestrator | 仅保留 ffmpeg-*；遗留 IDB synthesize/process 可 fail-fast stub |

依赖方向不变。浏览器不得 import `@smm/core` 根 barrel。

### 2.2 App Level Architecture

| Piece | Location | Role |
|--------|----------|------|
| `SynthesizeSubtitleJob` | `apps/core/src/jobs/SynthesizeSubtitleJob.ts` | kind `synthesize-subtitle` |
| `ProcessSubtitleJob` | `apps/core/src/jobs/ProcessSubtitleJob.ts` | kind `process-subtitle` |
| Snapshot types | `apps/core/src/jobs/types.ts` | 并入 `Job` 联合 |
| Request asserts | `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts`（或并列模块） | synthesize/process 请求校验 |
| Argv | `whitelistedCmd/videocaptioner.ts` | 已有 builders；可加 `buildSynthesizeSubtitleArgs` 等别名 |
| Server Port | `apps/server/src/core/VideoCaptionerPort.ts` | timeout ≥ 2h |
| HTTP | `apps/server/src/route/` | 两条新路由 + serializeJob |
| CLI | `apps/cli/src/cli/commands/` | synthesize / process |
| UI | dialogs、poll helpers、useJobManager、pipeline 行状态 | 镜像 + 停 Orchestrator 执行路径 |

删除或降级 `synthesizeJobFactory` / `processJobFactory`（无引用则删）。

### 2.3 Key Design

#### 双 Job + 共用队列

与 transcribe/translate 一致：两个 `AbstractJob` 子类，共用 Port 与 `videocaptioner` 队列。长 process 会挡住短 transcribe——产品已接受该取舍。

| kind | JobManager `timeoutMs` |
|------|------------------------|
| `transcribe-subtitle` / `translate-subtitle` | 10 min（已有） |
| `synthesize-subtitle` | 60 min |
| `process-subtitle` | 120 min |

#### Port 超时

`createVideoCaptionerPort` 今日 `VIDEOCAPTIONER_TIMEOUT_MS = 10 * 60 * 1000`。本轮改为 **至少 2h**（推荐常量 `2 * 60 * 60 * 1000`，与最长 Job 对齐）。JobManager 的 per-submit timeout 仍负责队列侧取消；两者都应 ≥ 对应 Job，避免双重误杀。

可选后续（非本轮必须）：`VideoCaptionerRunRequest` 增加 `timeoutMs` 由 Job 传入。本轮用固定 ≥2h 即可。

#### Core API

```ts
core.synthesizeSubtitle(req) → { id }
core.processSubtitle(req)    → { id }
```

缺 `videoCaptioner` Port 时抛业务错误（与字幕 Job 一致）。

**Synthesize 请求：** `folder`, `videoPath`, `subtitlePath`, `title?`, `subtitleMode?`, `quality?`, `style?`, `renderMode?`, `layout?`

**Process 请求：** `folder`, `mediaPath`, `title?`, 转写选项（`asr?`, `language?`, `wordTimestamps?`, `format?`）, `noOptimize?`, `noSplit?`, `noTranslate?`, 翻译（`translator?`, `targetLanguage?`, `reflect?`, `layout?`, `prompt?`, `llm?`）, 合成（`noSynthesize?`, `subtitleMode?`, `quality?`, `style?`, `renderMode?`, `synthesizeLayout?`）

路径：调用方传宿主平台绝对路径。Core 不做 POSIX↔平台转换。argv 走现有 Core builders（process 经 `processJobDataToCliOptions` 或等价扁平→嵌套映射）。

#### 快照

```ts
kind: "synthesize-subtitle" | "process-subtitle"
type: 同上
status, progress, error?, createdAt, updatedAt
+ 业务字段（路径与非敏感选项）
```

process 快照 **不含** `llm`（`apiKey` / `apiBase` / `model`）。

#### HTTP

判别联合 `{ data } | { error }`；HTTP 200 承载业务结果。

| POST | 成功体 |
|------|--------|
| `/api/synthesize-subtitle` | `{ data: { id } }` |
| `/api/process-subtitle` | `{ data: { id } }` |
| 现有 get-job / get-jobs / get-job-log / stop-job | 序列化 / 停止新 kind |

#### CLI

```bash
smm synthesize <video> -s <subtitle> --folder <path> [--subtitle-mode soft|hard] [--quality …] [--style …] [--render-mode …] [--layout …] [--title …] [-v]
smm process <media> --folder <path> [--asr …] [--language …] [--format …] [--word-timestamps]
  [--no-optimize] [--no-split] [--no-translate] [--translator …] [--target-language …]
  [--reflect] [--layout …] [--prompt …] [--api-key …] [--api-base …] [--model …]
  [--no-synthesize] [--subtitle-mode …] [--quality …] [--synthesize-layout …] [--title …] [-v]
```

本进程 Core 入队 → `waitForJobUntilCompleted` → exit 0（succeeded）/ 1。不做 CLI 连远端 daemon。

#### UI

- 对话框 Confirm → Core HTTP → Zustand 镜像 `synthesize-subtitle` / `process-subtitle` → `pollSubtitleJob`（或扩展 kind）→ 终态。
- `useJobManager` stop/remove 走 `stopJobViaCore`（与 ytdlp / 字幕镜像同类）。
- Orchestrator：移除 synthesize/process 执行路径（或 fail-fast stub）；保留 ffmpeg。
- 行状态：Core 镜像按 `mediaPath` / `videoPath` 合并；遗留 IDB 类型只读。

## 3. User Stories

### 3.1 UI 合成字幕经 Core

* **Given** - 用户在 Synthesize 对话框选中视频与字幕并 Confirm  
* **When** - UI `POST /api/synthesize-subtitle`  
* **Then** - 返回 job id；后台列表出现 `synthesize-subtitle`；终态 succeeded/failed；不再经 Orchestrator 执行  

### 3.2 UI process 流水线经 Core

* **Given** - 用户在 Process Pipeline 对话框 Confirm（可含 llm）  
* **When** - UI `POST /api/process-subtitle`  
* **Then** - 返回 id；快照无 llm 字段；可 `stop-job` 中止  

### 3.3 CLI process 等待

* **Given** - 假或真 VideoCaptionerPort  
* **When** - `smm process ./a.mp4 --folder ./lib --asr bijian --no-translate --no-synthesize`  
* **Then** - 阻塞至终态；succeeded → exit 0，否则 1  

### 3.4 Port 不再 10 分钟误杀

* **Given** - 一个 running 的 process-subtitle Job 超过 10 分钟仍未结束  
* **When** - Port / JobManager 在 2h 内未超时  
* **Then** - Job 不被 10min Port 超时标 failed（除非真正 abort 或 VC exit≠0）  

## 4. Testing

| 层 | 要点 |
|----|------|
| Core | 假 Port：argv、exit≠0→failed、abort、process 快照无 llm |
| JobManager | synthesize/process 与字幕 Job 同队列串行；各自 timeout 配置正确 |
| HTTP | 入队 id；get-job kind；缺字段 `{ error }` |
| Server Port | 超时常量 ≥ 2h（或单测覆盖） |
| UI | 对话框 mock Core；Orchestrator 不再 spawn synthesize/process |
| CLI | 假 Port exit 0/1 |

## 5. Documentation

- 更新 [docs/dev/job.md](../../dev/job.md)：新 kind、超时表、CLI。
- 更新 [docs/api/index.md](../../api/index.md)：两条 POST。
- 本 design 为黄金源；与 [2026-10-17-transcribe-translate-subtitle-jobs-design.md](./2026-10-17-transcribe-translate-subtitle-jobs-design.md) 并列。

## 6. Non-Goals (explicit)

- 不迁 ffmpeg 任务。
- 不把 process 拆成多 Core Job 编排。
- 不解析 videocaptioner 百分比进度。
- 不持久化 Job 跨进程。
- 不让浏览器依赖 `@smm/core` 根 barrel。
- 不把 synthesize/process 拆到独立队列（产品已选共用 `videocaptioner`）。
