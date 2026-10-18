# FFmpeg Compress E2E

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

Core `FfmpegCompressJob` / `smm compress` / Video Compression dialog are landed. There is no end-to-end coverage that runs real ffmpeg against a downloadable sample. Format conversion UI e2e (`ConvertVideoFormat.e2e.ts`) is the closest pattern.

**Constraints:**

- Success = job/CLI exit success + output file exists with `size > 0` (no size-ratio check).
- UI: default preset, Start only (no Custom tab).
- Sample: download once to repo `.local/samples/sample.mp4` from  
  `https://github.com/lawrenceching/SMM/releases/download/v0.0.1/sample.mp4`
- `prepareVideoFile(filepath)` lives in `apps/e2e/test/lib/testbed.ts`.
- CLI tests under `apps/e2e/cli`; UI under `apps/e2e/common/ffmpeg`.
- Skip on HarmonyOS; skip when ffmpeg unavailable (Docker assumed available).

## 2. Architecture

### 2.1 `prepareVideoFile`

```
filepath
  ← copyFile(.local/samples/sample.mp4)
       ↑ if missing: GET SAMPLE_MP4_URL → write cache
```

Host Node fs only (same as existing example-MP4 placement for property dialog).

### 2.2 CLI e2e

`apps/e2e/cli/compress.test.ts`: temp dir + `prepareVideoFile` →  
`smm compress <in> -o <out> --folder <dir> --container mp4` → exit 0 + out size > 0.

### 2.3 UI e2e

`apps/e2e/common/ffmpeg/CompressVideo.e2e.ts`: music folder → `prepareVideoFile` into folder → import → context menu Video Compression → Start → assert output file size > 0.

## 3. Non-Goals

- Volume comparison / quality metrics.
- Custom-tab / encoder matrix.
- Committing `sample.mp4` into git.
