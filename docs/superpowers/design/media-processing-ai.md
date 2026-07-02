# Media Processing: AI-powered Operations

使用 AI 对媒体文件进行字幕生成(Transcribe)、翻译、合成和内容总结(Summarize)。

## 1. Transcribe, Translate, Synthesize, Process

通过 `videocaptioner` 命令行工具对视频/音频进行转写、翻译、合成、全流程处理。

> **架构演进**: 原设计基于 Service Worker，现已迁移到主线程 `JobOrchestratorProvider`。任务流程和 API 接口不变。

### 1.1 Architecture

```
TranscribeDialog → saveJob to IndexedDB
  → JobOrchestratorProvider auto-starts next pending job
  → executeCmdToCompletionWithHeaders({ command: "videocaptioner", ... })
  → updates IDB job status (running → succeeded/failed)
  → MusicPanel displays job status per row
```

### 1.2 Data Model

`TaskJobRecord` (IndexedDB `jobs` table):
- `type`: `transcribe` | `translate` | `synthesize` | `process`
- `status`: `pending` → `running` → `succeeded` / `failed` / `stopped`
- `data.folder`: Media folder path
- `data.mediaPath`: POSIX absolute path (for UI row matching)
- `data.executionId`: Command execution ID (for log lookup)

### 1.3 Key Components

| Component | Role |
|-----------|------|
| `TranscribeDialog` | Job enqueueing (not execution) |
| `JobOrchestratorProvider` | Central job lifecycle, auto-start queue |
| `useTranscribeManager` | Per-panel view: `transcribingPaths`, `jobIdByPath` |
| `MusicPanel` / `MusicFileTable` | Row-level status display (loading/failed icons) |

## 2. AI Summarize

右键菜单 "总结" — 读取字幕文件内容，经 AI 大模型生成摘要写入 `{stem}_summary.txt`。

### 2.1 Architecture

与字幕操作不同，"总结"不依赖 Background Jobs，而是在前端组件内直接调用 AI SDK：

```
LocalFileTableRow (handleSummarize)
  → readFile(subtitlePath) → subtitle content
  → summarizeVideo({ content, aiProvider, reverseProxyUrl })
    → createOpenAICompatible({ baseURL: reverseProxyUrl, headers: { X-SMM-Proxy-Upstream-BaseURL } })
    → generateText({ model, system, prompt, abortSignal: AbortSignal.timeout(120_000) })
  → writeFile(outputPath, summary) — 自动处理文件名冲突 (_summary_1.txt, _summary_2.txt ...)
  → setIsSummarizing(false), toast result
```

### 2.2 Key Design Decisions

- 前端直接调用 `@ai-sdk/openai-compatible` 的 `generateText`
- 经 CLI Reverse Proxy 转发到 AI Provider
- 2 分钟超时保护 (`AbortSignal.timeout(120_000)`)
- 使用组件内 `useState` 管理 `isSummarizing` 状态（不用 IDB + SW）

## 3. Error Handling

### 3.1 videocaptioner + ffmpeg 失败 Toast 带 "日志" 按钮

`JobOrchestratorProvider.executeJob()` 在所有有 `executionId` 的 job 失败时，toast 添加 "日志" action button → 打开 `LogDialog` 查看命令执行日志。

**适用 job types**: `transcribe`, `translate`, `synthesize`, `process`, `ffmpeg-convert`, `download-video`

### 3.2 AI Summary 错误分类

`summarizeVideo.ts` 将 AI 调用错误转换为用户友好提示：

| 错误类型 | 用户提示 |
|---------|---------|
| Network failure / fetch failed | "Network connection failed" |
| Timeout / aborted | "AI summary request timed out" |
| 401 / 403 | "AI provider authentication failed" |
| 429 | "AI provider rate limit exceeded" |
| 5xx | "AI provider server error" |
