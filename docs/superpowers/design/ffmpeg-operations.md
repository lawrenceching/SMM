# FFmpeg Operations

SMM 的 FFmpeg 操作涵盖格式转换、视频压缩、进度显示和错误处理。

## 1. Format Converter

`FormatConverterDialog` 将视频/音频转换为不同容器格式（MP4 H.264/H.265、WebM VP9、MKV）和图像格式。

### 1.1 Pipeline

```
FormatConverterDialog
  → POST /api/ffmpeg-convert  (UI apiFetch / Hono RPC)
  → Core.ffmpegConvert()
  → JobManager.submit(FfmpegConvertJob, { queue: "ffmpeg", timeoutMs: 1h })
  → buildFfmpegConvertArgs()  // apps/core whitelistedCmd/ffmpeg
  → FfmpegPort.run({ command: "ffmpeg", args, … })
```

Poll `POST /api/get-job` for snapshot `progress` / `etaSeconds` / terminal status. Logs via `POST /api/get-job-log`.

### 1.2 Image Format Output (AVIF / WebP / APNG)

扩展 FormatConverterDialog 支持视频转动画图像：

| Format | Encoder | Key Options |
|--------|---------|-------------|
| **AVIF** | `libaom-av1` (default), `libsvtav1`, `librav1e` | `crf` (0–63), `cpu-used` (0–8), `still-picture` |
| **WebP** | `libwebp` (still), `libwebp_anim` (animated) | `lossless`, `quality` (0–100), `preset` |
| **APNG** | `apng` | `pred` (lossless), `plays` (loop), `final_delay` |

选择图像格式时，UI 显示对应的编码选项（替换通用视频 preset）。

### 1.3 Convert Error Handling

当 ffmpeg 转换失败时，按退出码和 stderr 匹配分类错误，在对话框内显示用户友好的内联提示（不使用 toast）。

**分类优先级**（`classifyFfmpegConvertError`）:
1. `systemMessage` 包含 `timed out` → timeout
2. `exitCode === 123` → cancelled
3. `exitCode === 69` → error-rate-exceeded
4. stderr 模式匹配：`encoder-not-found`, `decoder-not-found`, `muxer-not-found`, `file-not-found`, `permission-denied`, `disk-full`, `out-of-memory`, `invalid-data` 等
5. `exitCode === 1` → generic
6. fallback → unknown（只记 console.error，不向用户展示 stderr）

**数据流**:
```
FfmpegConvertJob → snapshot.error / status failed
  → FormatConverterDialog / poll mirror catch → setErrorMessage(t(i18nKey))
  → 内联 <Alert variant="destructive">
```

## 2. Video Compression

`VideoCompressionDialog` — 独立于 FormatConverterDialog 的专用压缩对话框，经 `POST /api/ffmpeg-compress` 入队 Core `FfmpegCompressJob`（与 convert **共用** `ffmpeg` 队列，并发 1）。

### 2.1 Features

- **5 个预设**: 极速压缩 / 均衡 / 高质量 / 极限压缩 / 仅音频
- **自定义 Tab**: 容器选择、视频/音频编码器、CRF/目标比特率/目标文件大小、分辨率缩放、帧率控制
- **硬件编码器**: NVENC、QSV、AMF、VideoToolbox（启动时通过 `ffmpeg -encoders` 自动检测并缓存）
- **两遍编码**: targetBitrate/targetSize 模式下自动启用

### 2.2 Data Model

压缩请求体使用独立的 `compressOptions`（不再用 `compress-*` 伪 `outputFormat`）。`FfmpegCompressJob` kind 为 `ffmpeg-compress`。

### 2.3 Entry Points

- 系统菜单 → Video Compression
- MusicPanel / TvShowPanel / MoviePanel 右键菜单
- CLI: `smm compress`

## 3. Progress Display

ffmpeg 转码/压缩的实时进度（百分比、ETA）来自 Core Job snapshot（`progress` / `etaSeconds`），由 Job 内解析 ffmpeg stderr，经 `POST /api/get-job` 轮询。

### 3.1 Parsing

ffmpeg stderr 输出结构化进度行：
```
Duration: 00:02:59.71, start: 0.000000, bitrate: 793 kb/s
frame= 5390 fps=253 q=39.7 Lsize= 4998KiB time=00:02:59.60 ...
```

解析 `Duration`（总时长）和最新 `time=`（当前时间）计算进度百分比和 ETA（Core `pipeline/ffmpeg/progress`）。

### 3.2 UI

对话框与 BackgroundJobs 镜像通过 Core job id 轮询 `get-job`（不再依赖 Command Log `executionId` 进度 hook）。

### 3.3 2-Pass 压缩

两遍编码在同一 `FfmpegCompressJob` 内完成：pass1 → progress 0–50，pass2 → 50–100。

## 4. Scope Boundaries

| In scope | Out of scope |
|----------|-------------|
| Core `ffmpeg-convert` / `ffmpeg-compress` Jobs | `ffmpeg-write-tags`（仍留 UI JobOrchestrator） |
| 视频转图像 (AVIF/WebP/APNG) | jpg/png/webp 瞬态转换 |
| BackgroundJobsPopover 进度显示（Core snapshot） | generateFfmpegScreenshots (内联执行) |
| CLI `smm convert` / `smm compress` | 浏览器 import `@smm/core` 根 barrel |
