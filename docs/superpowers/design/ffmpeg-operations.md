# FFmpeg Operations

SMM 的 FFmpeg 操作涵盖格式转换、视频压缩、进度显示和错误处理。

## 1. Format Converter

`FormatConverterDialog` 将视频/音频转换为不同容器格式（MP4 H.264/H.265、WebM VP9、MKV）和图像格式。

### 1.1 Pipeline

```
FormatConverterDialog
  → buildFfmpegConvertJob()
  → JobOrchestrator (ffmpeg-convert)
  → buildFfmpegConvertArgs()  // packages/core/whitelistedCmd/ffmpeg.ts
  → executeCmdToCompletion({ command: "ffmpeg", args })
```

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
executeCmdToCompletion → { exitCode, stderr }
  → classifyFfmpegConvertError() → { type, i18nKey }
  → throw FfmpegConvertError
  → FormatConverterDialog catch → setErrorMessage(t(i18nKey))
  → 内联 <Alert variant="destructive">
```

## 2. Video Compression

`VideoCompressionDialog` — 独立于 FormatConverterDialog 的专用压缩对话框，复用同一个 `ffmpeg-convert` 后台任务管道。

### 2.1 Features

- **5 个预设**: 极速压缩 / 均衡 / 高质量 / 极限压缩 / 仅音频
- **自定义 Tab**: 容器选择、视频/音频编码器、CRF/目标比特率/目标文件大小、分辨率缩放、帧率控制
- **硬件编码器**: NVENC、QSV、AMF、VideoToolbox（启动时通过 `ffmpeg -encoders` 自动检测并缓存）
- **两遍编码**: targetBitrate/targetSize 模式下自动启用

### 2.2 Data Model

扩展 `FfmpegConvertBackgroundJobData` 添加可选 `compressOptions` 字段。现有 FormatConverterDialog 任务不受影响。

### 2.3 Entry Points

- 系统菜单 → Video Compression
- MusicPanel / TvShowPanel / MoviePanel 右键菜单

## 3. Progress Display

ffmpeg 转码/压缩的实时进度（百分比、ETA）通过 Command Log 轮询获取。

### 3.1 Parsing

ffmpeg stderr 输出结构化进度行：
```
Duration: 00:02:59.71, start: 0.000000, bitrate: 793 kb/s
frame= 5390 fps=253 q=39.7 Lsize= 4998KiB time=00:02:59.60 ...
```

解析 `Duration`（总时长）和最新 `time=`（当前时间）计算进度百分比和 ETA。

### 3.2 Hook

`useFfmpegProgressQuery(executionId, isRunning)` — 基于 `useCommandLogQuery`，镜像 yt-dlp 的 `useYtdlpDownloadProgressQuery` 模式。

### 3.3 2-Pass 压缩

两次 pass 共用同一个 `executionId`，共享 `main.log` 文件，实现连续的进度 UI。

## 4. Scope Boundaries

| In scope | Out of scope |
|----------|-------------|
| ffmpeg-convert (转码/压缩) | ffmpeg-write-tags (元数据写入，瞬态) |
| 视频转图像 (AVIF/WebP/APNG) | jpg/png/webp 瞬态转换 |
| BackgroundJobsPopover 进度显示 | generateFfmpegScreenshots (内联执行) |
