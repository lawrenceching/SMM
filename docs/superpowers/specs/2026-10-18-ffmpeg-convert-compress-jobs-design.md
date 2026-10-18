# FfmpegConvertJob + FfmpegCompressJob

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

格式转换与视频压缩今天仍跑在 UI `JobOrchestratorProvider`：对话框经 IndexedDB 入队，类型同为 `ffmpeg-convert`（压缩靠 `compressOptions` 分支），Orchestrator 用 `executeCmd` 调 `ffmpeg` / `ffprobe`。yt-dlp 与 videocaptioner 字幕 Job 已迁到 Core（`CommandPort` / `VideoCaptionerPort` + 专用队列）。本设计把转换与压缩按同一模式迁到 Core。

`ffmpeg-write-tags` 操作很快，**不**迁为 Core 后台任务；仍留在 Orchestrator（本轮不改其执行路径）。

Core 已有 `buildFfmpegConvertArgs` / `buildFfmpegCompressArgs` 与 probe 类型（`apps/core/src/whitelistedCmd/ffmpeg.ts`）。尚无 `FfmpegPort`；现有 `CommandPort` 仅允许 `command: "yt-dlp"`。

**Constraints (product decision):**

- Scope: `FfmpegConvertJob` + `FfmpegCompressJob`；新建 `FfmpegPort`；新建队列 `ffmpeg` 并发 1；HTTP 入队 + 现有 `get-job` / `get-jobs` / `get-job-log` / `stop-job`；UI 两对话框切 Core；CLI `smm convert` / `smm compress`。
- Job 建模：**两个** AbstractJob 子类（不用单个 Job + `compressOptions?` 分支作为 kind 边界）。
- Queue: **共用** `ffmpeg`，并发 **1**；`timeoutMs` convert **1h**，compress **2h**（对齐现 Orchestrator `JOB_TIMEOUT_MS`）。
- Port timeout: Server `FfmpegPort` adapter 硬超时 **≥ 2h**，避免长压缩被 Port 先杀。
- Progress: Job 内解析 ffmpeg stderr（`Duration` / `time=` / `speed=`），snapshot 含 `progress` / `etaSeconds?`；两遍压缩 pass1 → 0–50，pass2 → 50–100。
- Out of scope: `ffmpeg-write-tags` 迁 Core；编码器探测 UI 改走 Job；跨进程持久化；浏览器 import `@smm/core` 根 barrel。
- Storage: 进程内内存，进程退出即丢。

## 2. Architecture

### 2.1 Project Level Architecture

```
UI / CLI
  → Core.ffmpegConvert / ffmpegCompress
  → JobManager.submit(…, { queue: "ffmpeg", timeoutMs: 1h | 2h })
  → FfmpegConvertJob | FfmpegCompressJob
  → FfmpegPort.run({ command: "ffmpeg"|"ffprobe", args, signal, onStderrLine? })
  → apps/server 适配器（runCommand：ffmpeg/ffprobe、命令日志、Abort；timeout ≥ 2h）
```

| 层 | 职责 |
|----|------|
| `apps/core` | `FfmpegPort`、双 Job、stderr 进度解析、请求 assert、Core 公开方法；复用 `whitelistedCmd/ffmpeg` argv builders |
| `apps/server` | `createFfmpegPort`；`POST /api/ffmpeg-convert`、`/api/ffmpeg-compress`；`serializeJob` |
| `apps/cli` | `smm convert` / `smm compress`（本进程 Core，等终态 exit 0/1） |
| `apps/ui` | FormatConverter / VideoCompression 对话框 Core HTTP；Zustand 镜像；删 convert/compress factories |
| Orchestrator | **保留** `ffmpeg-write-tags`；旧 IDB `ffmpeg-convert` fail-fast stub |

依赖方向不变：`apps/cli → apps/server → apps/core`。浏览器不得 import `@smm/core` 根 barrel（可继续从 `@smm/core/whitelistedCmd/constants` 等子路径取常量类型）。

### 2.2 App Level Architecture

| Piece | Location | Role |
|--------|----------|------|
| `FfmpegPort` | `apps/core/src/ports/FfmpegPort.ts` | `command: "ffmpeg" \| "ffprobe"` |
| `FfmpegConvertJob` | `apps/core/src/jobs/FfmpegConvertJob.ts` | kind `ffmpeg-convert` |
| `FfmpegCompressJob` | `apps/core/src/jobs/FfmpegCompressJob.ts` | kind `ffmpeg-compress` |
| Progress helpers | `apps/core/src/pipeline/ffmpeg/progress.ts`（或并列） | 从 UI `useFfmpegProgressQuery` 迁/共享解析逻辑 |
| Snapshot types | `apps/core/src/jobs/types.ts` | 并入 `Job` 联合 |
| Request asserts | `apps/core/src/pipeline/ffmpeg/ffmpegJobsApi.ts` | convert/compress 请求校验 |
| Argv | `whitelistedCmd/ffmpeg.ts` | 已有 `buildFfmpegConvertArgs` / `buildFfmpegCompressArgs` |
| JobManager | `apps/core/src/jobs/jobManager.ts` | `JobQueueName` 增加 `"ffmpeg"`；concurrency 1 |
| Server Port | `apps/server/src/core/FfmpegPort.ts` | `runCommand` 适配，timeout ≥ 2h |
| HTTP | `apps/server/src/route/` | 两条新路由 + `serializeJob` |
| CLI | `apps/cli/src/cli/commands/` | convert / compress |
| UI | dialogs、poll helpers、background mirror、mutations | 镜像 + 停 Orchestrator 转换/压缩路径 |

删除 `apps/ui/src/lib/ffmpegConvertJobFactory.ts`、`ffmpegCompressJobFactory.ts`（及仅服务它们的测试）。`ffmpegWriteTagsJobFactory` **保留**。

### 2.3 Key Design

#### 双 Job + 共用 `ffmpeg` 队列

| kind | JobManager `timeoutMs` |
|------|------------------------|
| `ffmpeg-convert` | 60 min |
| `ffmpeg-compress` | 120 min |

长压缩会挡住短转换——产品接受（与 videocaptioner 队列同取舍）。`default` / `ytdlp` / `videocaptioner` 互不抢此队列。

#### `FfmpegPort`（不拓宽 `CommandPort`）

```ts
interface FfmpegRunRequest {
  command: "ffmpeg" | "ffprobe";
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

interface FfmpegRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface FfmpegPort {
  run(request: FfmpegRunRequest, signal: AbortSignal): Promise<FfmpegRunResult>;
}
```

注入：`PlatformPorts.ffmpeg`（命名与现有 `command` / `videoCaptioner` 并列）。缺 Port 时 Core API / Job 抛业务错误。

Server adapter 硬超时推荐常量 `2 * 60 * 60 * 1000`。JobManager per-submit timeout 仍负责队列侧取消。

#### Core API

```ts
core.ffmpegConvert(req)  → { id }
core.ffmpegCompress(req) → { id }
```

**Convert 请求：** `folder`, `inputPath`, `outputPath`, `outputFormat`, `preset`, `title?`, `imageOptions?`

**Compress 请求：** `folder`, `inputPath`, `outputPath`, `compressOptions`, `title?`  
（`outputFormat` 由 compress 选项/容器推导时，以现有 `buildFfmpegCompressArgs` / dialog 字段为准，assert 层显式列出。）

路径：调用方传宿主平台绝对路径。Core 不做 POSIX↔平台转换。

**Compress 运行时：** Job 内先 `ffprobe` 取 duration/width/height → `buildFfmpegCompressArgs` → `kind: "single"` 一次 `ffmpeg`，或 `kind: "two-pass"` 顺序两次 `ffmpeg`（共享同一 job 日志 / AbortSignal）。pass log 清理逻辑迁入 Job（对齐现 Orchestrator）。

#### 进度

- 将 UI `parseHmsTime` / `parseFfmpegProgressLine` / Duration 提取逻辑落到 Core（UI 可删或改为薄 re-export，但**进度数据源**改为 Job snapshot）。
- Convert：`progress = clamp(0..100, time/Duration * 100)`；有 `speed=` 时算 `etaSeconds`。
- Compress 单遍：同 convert。
- Compress 两遍：pass1 映射 0–50；pass2 映射 50–100。
- 无 Duration（部分图像转换）：`progress` 保持 0，成功后 100；`etaSeconds` 省略。

#### 快照

```ts
kind: "ffmpeg-convert" | "ffmpeg-compress"
type: 同上  // 与既有 Job snapshot 习惯一致时可双写
id, status, progress, etaSeconds?, error?, createdAt, updatedAt
folder, title?, inputPath, outputPath
// convert: outputFormat, preset, imageOptions?
// compress: compressOptions（无密钥字段）
```

#### HTTP

判别联合 `{ data } | { error }`；HTTP 200 承载业务结果（API 设计指南）。

| POST | 成功体 |
|------|--------|
| `/api/ffmpeg-convert` | `{ data: { id } }` |
| `/api/ffmpeg-compress` | `{ data: { id } }` |
| 现有 get-job / get-jobs / get-job-log / stop-job | 序列化 / 停止新 kind |

#### CLI

```bash
smm convert <input> -o <output> --folder <path> --format <fmt> --preset <preset> […] [--title …] [-v]
smm compress <input> -o <output> --folder <path> [compress option flags …] [--title …] [-v]
```

本进程 Core 入队 → `waitForJobUntilCompleted` → exit 0（succeeded）/ 1。不做 CLI 连远端 daemon。

#### UI

- FormatConverter Confirm → `POST /api/ffmpeg-convert` → Zustand 镜像 `ffmpeg-convert` → poll `get-job`。
- VideoCompression Confirm → `POST /api/ffmpeg-compress` → 镜像 `ffmpeg-compress` → poll。
- 后台列表进度读 snapshot，**不再**用 `useFfmpegProgressQuery` 轮询 command-log 算进度；日志按钮仍可走 `get-job-log`。
- `useJobManager` stop/remove 对 Core mirror 走 `stopJobViaCore`。
- Orchestrator：`ffmpeg-convert` 执行路径 fail-fast；**保留** `ffmpeg-write-tags`。

#### 错误

- exit ≠ 0 → `failed` + `error`（可读消息；可复用/下沉 `classifyFfmpegConvertError`）。
- User abort / AbortSignal → `aborted`（与 `YtdlpJob` / 字幕 Job 一致）。
- JobManager `timeoutMs` 触发 → 按现有 `JobManager` + `AbstractJob` 惯例结束（与 ytdlp/videocaptioner 相同路径，不单开语义）。

## 3. User Stories

### 3.1 UI 格式转换经 Core

* **Given** - 用户在 Format Converter 对话框选好输入/输出并 Start  
* **When** - UI `POST /api/ffmpeg-convert`  
* **Then** - 返回 job id；后台列表出现 `ffmpeg-convert`；进度来自 snapshot；终态 succeeded/failed；不再经 Orchestrator 执行  

### 3.2 UI 视频压缩（含两遍）经 Core

* **Given** - 用户在 Video Compression 对话框 Confirm（可能触发 two-pass）  
* **When** - UI `POST /api/ffmpeg-compress`  
* **Then** - Job 内 probe + 单遍或两遍 ffmpeg；两遍时进度跨 0–50 / 50–100；可 `stop-job` 中止  

### 3.3 CLI convert / compress 等待

* **Given** - 假或真 `FfmpegPort`  
* **When** - `smm convert …` 或 `smm compress …`  
* **Then** - 阻塞至终态；succeeded → exit 0，否则 1  

### 3.4 write-tags 仍非本轮目标

* **Given** - 用户写媒体标签  
* **When** - 仍走现有 Orchestrator `ffmpeg-write-tags`  
* **Then** - 行为不变；无新 Core kind / HTTP 入队  

## 4. Testing

| 层 | 要点 |
|----|------|
| Core progress | 解析 `time=` / `Duration` / `speed=`；两遍 0–50/50–100 |
| Core Jobs | 假 Port：argv、exit≠0→failed、abort、compress probe→ffmpeg |
| JobManager | `ffmpeg` 队列串行；convert/compress 各自 timeout |
| HTTP | 入队 id；get-job kind；缺字段 `{ error }` |
| Server Port | 超时常量 ≥ 2h |
| UI | 对话框 mock Core；进度不依赖 command-log query；Orchestrator convert fail-fast；write-tags 仍可执行 |
| CLI | 假 Port exit 0/1 |

红绿原则：临时破坏生产代码确认测试失败后再恢复。

## 5. Documentation

- 更新 [docs/dev/job.md](../../dev/job.md)：新队列 `ffmpeg`、kind、超时、CLI、FFmpeg 不再走 Orchestrator（write-tags 例外）。
- 更新 [docs/api/index.md](../../api/index.md)：两条 POST。
- 更新 [docs/superpowers/design/ffmpeg-operations.md](../design/ffmpeg-operations.md)：管道改为 Core Job。
- 本 design 为黄金源；与字幕 / ytdlp Core Job designs 并列。

## 6. Non-Goals (explicit)

- 不迁 `ffmpeg-write-tags` 为 Core 后台任务（也不在本轮改为同步-only HTTP，除非已有路径）。
- 不把 convert/compress 拆到两条独立队列。
- 不拓宽 `CommandPort` 以承载 ffmpeg（用独立 `FfmpegPort`）。
- 不持久化 Job 跨进程。
- 不让浏览器依赖 `@smm/core` 根 barrel。
- 不把编码器列表探测（`ffmpeg -encoders`）改成 Job。
- 不保留 UI command-log 进度作为第二数据源（snapshot 为唯一进度源）。
