# Docker 3PP Binary Images

为第三方二进制（ffmpeg/ffprobe、yt-dlp、VideoCaptioner、QuickJS）创建独立的中间镜像 Dockerfile，使最终镜像 `smm:latest` 能够通过 `COPY --from=` 装配所有 3pp 组件。

[Complete the checklist below]
[ ] New UI component
[ ] New user config
[ ] Electron only
[x] User document — `apps/docker/README.md` 更新

## 1. Background

`apps/docker/` 已完成 CLI / UI 中间镜像拆分（`cli.Dockerfile` / `ui.Dockerfile`），但 3pp 二进制被推迟。原 `ci/download-3pp-binary.sh` 脚本在一个 RUN 层中下载全部 3pp 并安装到 `bin/` 目录。

4 个 3pp 组件各自独立地从官方渠道直接下载：ffmpeg/ffprobe（linux/win→BtbN FFmpeg-Builds、mac-arm64→osxexperts）、yt-dlp（官方 GitHub release）、videocaptioner（GitHub release）、quickjs（bellard.org）。升级任何一个组件时，不需要重新下载/构建其他组件——这是拆分为独立镜像的核心原因。

> **Status（2026-08-09）**：所有 3pp 二进制均改为从官方渠道直接下载，`plugins.tar.gz` 与 npm 包（`ffmpeg-static` / `@derhuerst/ffprobe-static`）全部弃用。Docker 与桌面版 `ci/download-3pp-binary.sh` 使用相同来源。

详见 [context.md](./context.md)。

## 2. Architecture

### 2.1 Dockerfile 分拆

| Dockerfile | 中间镜像标签 | 内容 | 来源 |
|---|---|---|---|
| `ffmpeg.Dockerfile` | `smm-ffmpeg:<ffmpeg_version>` | `/bin/ffmpeg/{ffmpeg,ffprobe}` + `/bin/quickjs/{qjs,…}` | BtbN FFmpeg-Builds + bellard.org |
| `ytdlp.Dockerfile` | `smm-ytdlp:latest` | `/bin/yt-dlp/yt-dlp` | yt-dlp 官方 GitHub release |
| `videocaptioner.Dockerfile` | `smm-videocaptioner:latest` | `/bin/videocaptioner/{videocaptioner,…}` | GitHub releases |

每个 Dockerfile 使用两阶段构建：
- **builder**：所有 3pp Dockerfile 均为 `alpine:3.20`（`curl`/`tar`/`unzip` 直接下载提取）
- **output**（`scratch`）：仅保留提取出的二进制文件

### 2.2 最终镜像装配

`smm:latest` 的 Dockerfile（`apps/docker/Dockerfile`）新增三个 `FROM` 源：

```
FROM smm-cli-build:latest AS cli
FROM smm-ui-build:latest AS ui
FROM smm-ffmpeg:latest AS ffmpeg
FROM smm-ytdlp:latest AS ytdlp
FROM smm-videocaptioner:latest AS videocaptioner

FROM debian:bookworm-slim
...
COPY --from=ffmpeg        / /app/resources/
COPY --from=ytdlp         / /app/resources/
COPY --from=videocaptioner / /app/resources/
ENV SMM_RESOURCES_PATH=/app/resources
```

多个 `COPY --from` 会叠加目录树，互不覆盖。

### 2.3 架构选择

每个 Dockerfile 接受 Docker 内置的 `ARG TARGETARCH`（`amd64` / `arm64`），在 builder 阶段选择对应架构的二进制：

| 架构 | ffmpeg 源 | yt-dlp file | VC suffix | QJS zip |
|---|---|---|---|---|
| `amd64` | BtbN `linux64` | `yt-dlp_linux` | `linux-x64` | `quickjs-linux-x86_64-{ver}.zip` |
| `arm64` | BtbN `linuxarm64` | `yt-dlp_linux_aarch64` | `linux-arm64` | `quickjs-cosmo-{ver}.zip` |

### 2.4 版本可覆写

每个 Dockerfile 声明 `ARG` 使下游构建可覆盖版本或仓库：

```dockerfile
ARG FFMPEG_VERSION=8.1
ARG YTDLP_VERSION=2026.07.04
# ...
ARG VIDEOCAPTIONER_VERSION=1.0.0
ARG VIDEOCAPTIONER_REPO=lawrenceching/VideoCaptioner
```

## 3. Key Decisions

| 项 | 方案 | 理由 |
|---|---|---|
| QuickJS 归属 | 放在 `ffmpeg.Dockerfile` 中 | 二者都是基础设施类二进制，变动频率低；避免多一个文件 |
| 输出阶段 | `FROM scratch` | 与 `cli.Dockerfile` / `ui.Dockerfile` 一致；镜像体积最小 |
| 最终 base | `debian:bookworm-slim`（而非原设计的 `alpine:3.20`） | 3pp 二进制均为 glibc 链接，Alpine musl 运行时会因缺少 `libmvec.so.1` / `posix_fallocate64` 等符号而失败。`gcompat` 兼容层不足以覆盖所有缺失符号。`cli.Dockerfile` 的 builder 同步切换为 `node:22-bookworm-slim` 以产出 glibc CLI |
| TARGETARCH | 使用 Docker 内置 build arg | 与现有 Dockerfile 一致 |
| 多架构支持 | **仅 linux** | 3pp Dockerfile 专为 Docker 最终镜像设计；Electron 桌面版通过 `electron-builder.yml` 的 `extraResources` 获取 Windows/macOS 二进制 |

## 4. Files

### 4.1 `apps/docker/ffmpeg.Dockerfile`

- Builder: `FROM alpine:3.20`
- 安装 `curl tar xz unzip`
- 按 TARGETARCH 直接下载 ffmpeg/ffprobe（linux→BtbN FFmpeg-Builds），复制到 `/output/bin/ffmpeg/`
- 下载 QuickJS zip（bellard.org），提取 `qjs` 及附属文件
- 输出阶段: `FROM scratch; COPY --from=builder /output /`
- 产物在 builder 中位于 `/output/bin/ffmpeg/` 和 `/output/bin/quickjs/`

### 4.2 `apps/docker/ytdlp.Dockerfile`

- Builder: `FROM alpine:3.20`
- 安装 `curl`
- 按 TARGETARCH 从 yt-dlp 官方 GitHub release 下载 `yt-dlp_linux{,_aarch64}`
- 输出阶段: `FROM scratch; COPY --from=builder /output /`
- 产物在 builder 中位于 `/output/bin/yt-dlp/`

### 4.3 `apps/docker/videocaptioner.Dockerfile`

- Builder: `FROM alpine:3.20`
- 安装 `curl tar`
- 下载 videocaptioner release tar.gz，提取全部文件
- 输出阶段: `FROM scratch; COPY --from=builder /output /`
- 产物在 builder 中位于 `/output/bin/videocaptioner/`

## 5. Update to Final Dockerfile

`apps/docker/Dockerfile` 的变更：

- 新增三个 `FROM` 源：`smm-ffmpeg:latest`、`smm-ytdlp:latest`、`smm-videocaptioner:latest`
- final stage 新增三个 `COPY --from=` 将产物叠加到 `/app/resources/`
- 恢复 `ENV SMM_RESOURCES_PATH=/app/resources`

## 6. Update to package.json

`apps/docker/package.json` 新增三个 build 脚本：

```json
"build:ffmpeg": "docker buildx build --progress=plain -t smm-ffmpeg:latest -f ffmpeg.Dockerfile ../..",
"build:ytdlp": "docker buildx build --progress=plain -t smm-ytdlp:latest -f ytdlp.Dockerfile ../..",
"build:videocaptioner": "docker buildx build --progress=plain -t smm-videocaptioner:latest -f videocaptioner.Dockerfile ../.."
```

## 7. Tasks

### 7.1 创建 ffmpeg.Dockerfile

[x] 创建 `apps/docker/ffmpeg.Dockerfile`
  - builder: `alpine:3.20`, 安装 `curl tar xz unzip`
  - 按 TARGETARCH 直接下载 BtbN ffmpeg/ffprobe
  - 下载 QuickJS（bellard.org），按 `TARGETARCH` 提取对应 release
  - output: `FROM scratch`

### 7.8 3pp 全部改为官方直接下载（2026-08-09）

[x] `ci/download-3pp-binary.sh`：ffmpeg/ffprobe 改为按平台直接下载（linux/win→BtbN、mac-arm64→osxexperts.net）；yt-dlp 改从官方 GitHub release 下载；删除 `plugins.tar.gz`
[x] `apps/docker/ffmpeg.Dockerfile`：builder 切 `alpine:3.20`，直接 curl 下载 ffmpeg/ffprobe + quickjs，完全摒弃 npm
[x] `apps/docker/ytdlp.Dockerfile`：改为从 yt-dlp 官方 GitHub release 直接下载
[x] 根 `package.json`：devDependencies 移除 `ffmpeg-static` / `@derhuerst/ffprobe-static`，`3pp.ffmpeg_version` 改为 `8.1`、`3pp.ytdlp_version` 改为 `2026.07.04`
[x] `pnpm-workspace.yaml`：`onlyBuiltDependencies` 移除两包
[x] 验证最终镜像与 CI 构建（2026-08-09：`smm-ffmpeg:8.1` 与 `smm-ytdlp:2026.07.04` 均已在 GHCR 双架构构建并推送）

### 7.2 创建 ytdlp.Dockerfile

[x] 创建 `apps/docker/ytdlp.Dockerfile`
  - 从 yt-dlp 官方 GitHub release 按 `TARGETARCH` 下载 `yt-dlp_linux{,_aarch64}`
  - output: `FROM scratch`

### 7.3 创建 videocaptioner.Dockerfile

[x] 创建 `apps/docker/videocaptioner.Dockerfile`
  - 下载 videocaptioner release，按 `TARGETARCH` 选 tar.gz
  - output: `FROM scratch`

### 7.4 更新最终 Dockerfile

[x] 更新 `apps/docker/Dockerfile`
### 7.5 更新 package.json
[x] 更新 `apps/docker/package.json`
### 7.6 更新文档
[x] 更新 `apps/docker/README.md`
### 7.7 验证
[x] 全流程构建验证
## 8. Backward Compatibility

| 场景 | 影响 |
|---|---|
| 已有 `smm:latest` 不含 3pp | 新构建的 `smm:latest` 包含 3pp，行为恢复至与原 Dockerfile 等价 |
| 最终镜像构建流程 | 新增 3 个前置构建步骤（文档说明）；不改变已有 `build:cli` / `build:ui` |
| `SMM_RESOURCES_PATH` 环境变量 | 回到 `/app/resources`（与原有值一致） |
| CI 流程 | 需在最终构建前先构建三个 3pp 中间镜像 |
