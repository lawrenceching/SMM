# yt-dlp Execution

yt-dlp 的执行架构：PTY 支持、进度显示和错误处理。

## 1. PTY Support (Windows)

Windows 上 yt-dlp (PyInstaller) 的 `write_string()` flush 在匿名管道中无效。

**解决方案**: `executeCmd` 新增 `tty: boolean` 选项，yt-dlp 调用时硬编码 `tty: true`，通过 ConPTY (node-pty) 运行。

```
executeCmd({ command: 'yt-dlp', args, tty: true })
  → node-pty spawn (isatty()=True) → 实时 progress JSON 正常输出
```

NDJSON 流协议不变。

## 2. Download Progress

实时下载进度（百分比、速度、ETA）通过 Command Log 轮询解析。

### 2.1 Architecture

```
executeCmd → yt-dlp --newline --progress-template '...'
  → stdout progress JSON lines
  → NDJSON { type: "progress", data: {...} }
  → main.log
  → useCommandLogQuery (200ms poll)
  → useYtdlpDownloadProgressQuery
  → BackgroundJobsPopover / MusicPanel JobRow
```

### 2.2 Parser

`parseYtdlpProgressLine` 解析 JSON 格式的进度行：
```json
{"downloaded_bytes": 12345, "total_bytes": 100000, "speed": 2500000, "eta": 30}
```

实时 transient 字段（progress/speed/ETA）**不持久化**到 IDB — 避免 IDB poll 覆盖 in-memory 状态。

### 2.3 Protocol

- CLI: `--newline` + `--progress-template` 参数
- 原始进度 JSON 行 → UI `parseYtdlpProgressLine` 镜像解析
- TanStack Query cache 共享：同一个 `executionId` 的不同组件（Popover + MusicPanel）命中缓存，零重复请求

## 3. Error Handling

### 3.1 Error Classification

`classifyYtdlpError` 分类 yt-dlp 的 20+ 种错误模式（退出码 + stderr 匹配）：

| 类型 | 匹配条件 |
|------|---------|
| `http-403` | `HTTP Error 403` |
| `http-404` | `HTTP Error 404` |
| `http-5xx` | `HTTP Error 5xx` |
| `unsupported-url` | `Unsupported URL` / extractor not found |
| `geo-restricted` | Geo-restriction 相关消息 |
| `login-required` | 需要登录/认证 |
| `rate-limited` | 速率限制 |
| ... | ... |

### 3.2 CLI HTTP Error Handling

DVD 调用 `/api/executeCmd` 时，CLI 返回非 200 状态码的场景也需正确分类。扩展 `classifyYtdlpError` 覆盖 fetch wrapper 产生的错误消息格式：

| Source | Message | Classification |
|--------|---------|---------------|
| `executeCmdStream` (no JSON body) | `HTTP 500: Internal Server Error` | `http-5xx` |
| CLI 400 (validation) | `command must be one of: ...` | `unknown` → user-friendly |
| CLI 404 (executable missing) | `yt-dlp executable not found` | `unknown` → user-friendly |
| Browser fetch (network down) | `TypeError: Failed to fetch` | `unknown` → user-friendly |

### 3.3 Error Display

- **list-formats 阶段**: DVD 对话框内显示内联错误
- **download 阶段**: `JobOrchestratorProvider` 失败 toast（带 "日志" action button）
