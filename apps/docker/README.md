# apps/docker

SMM Docker 镜像构建 workspace。镜像包含：

- **CLI**：`apps/cli` 的 Linux 可执行文件（glibc）
- **UI**：`apps/ui` 的前端静态资源
- **bin**：ffmpeg、ffprobe、yt-dlp、VideoCaptioner、QuickJS 等第三方可执行文件（Linux 版）

最终镜像基于 `debian:bookworm-slim`，与 `cli.Dockerfile`（同在 Debian 编译，产出 glibc CLI）及 3pp 二进制（ffmpeg / yt-dlp 等均为 glibc 链接）保持 ABI 一致。

## 开发计划

详见 [docs/development-plan.md](./docs/development-plan.md)。

## 构建与运行

**Published image:** [`lawrenceching/smm`](https://hub.docker.com/r/lawrenceching/smm) (`latest` = multi-arch amd64/arm64). Operators should pull from Docker Hub; the scripts below are for local development and CI image assembly.

最终镜像 (`smm:latest`) 由 `apps/docker/Dockerfile` 组装，但**不包含** CLI / UI / bin 的源码构建步骤——这些组件由独立的中间镜像提供。**构建最终镜像前必须先构建所有中间镜像**：

```bash
# 在 apps/docker 下，顺序执行
pnpm run build:cli          # 产出 smm-cli-build:latest
pnpm run build:ui           # 产出 smm-ui-build:latest
pnpm run build:ffmpeg       # 产出 smm-ffmpeg:latest (ffmpeg/ffprobe + quickjs)
pnpm run build:ytdlp        # 产出 smm-ytdlp:latest (yt-dlp)
pnpm run build:videocaptioner # 产出 smm-videocaptioner:latest (VideoCaptioner)
pnpm run build              # 引用上述五个镜像，组装 smm:latest

# 或从仓库根等价的 docker buildx 命令
docker buildx build --progress=plain -t smm-cli-build:latest        -f apps/docker/cli.Dockerfile .
docker buildx build --progress=plain -t smm-ui-build:latest         -f apps/docker/ui.Dockerfile  .
docker buildx build --progress=plain -t smm-ffmpeg:latest           -f apps/docker/ffmpeg.Dockerfile .
docker buildx build --progress=plain -t smm-ytdlp:latest            -f apps/docker/ytdlp.Dockerfile .
docker buildx build --progress=plain -t smm-videocaptioner:latest   -f apps/docker/videocaptioner.Dockerfile .
docker buildx build --progress=plain -t smm:latest                  -f apps/docker/Dockerfile .
```

如果只修改了 UI 源码但 CLI / bin 未变，可跳过对应的中间镜像构建。`Dockerfile` 仅在 `COPY --from=` 阶段拉取各镜像的产物，不会重新执行编译或下载。

运行镜像（示例）：

```bash
docker run --rm -p 30000:30000 \
  -e SMM_AUTH_TOKEN=your-secret-token \
  smm:latest
```

浏览器访问 `http://localhost:30000/?token=your-secret-token`。

认证默认开启（镜像内 `SMM_AUTH_ENABLED=true`，CLI 在检测到 Docker 环境时也会默认启用）。如需关闭：`-e SMM_AUTH_ENABLED=false`。

### CI 中的 3pp 版本管理

CI（`_build-docker-push.yml`）为三个 3pp 中间镜像各建一个独立 job，镜像标签与软件自身版本一致，版本号来自根目录 `package.json` 的 `3pp` 字段：

| 镜像 | 标签 | 版本来源 |
|---|---|---|
| `smm-ffmpeg` | `<ffmpeg_version>` | `3pp.ffmpeg_version` |
| `smm-ytdlp` | `<ytdlp_version>` | `3pp.ytdlp_version` |
| `smm-videocaptioner` | `<videocaptioner_version>` | `3pp.videocaptioner_version` |

> **ffmpeg 来源（2026-08-09 起）**：`3pp.ffmpeg_version` 现为 `ffmpeg-static` / `@derhuerst/ffprobe-static` npm 包版本（5.3.0，bundle FFmpeg 6.1.1，linux 走 johnvansickle glibc 静态构建）。ffmpeg/ffprobe 由这两个包在 `pnpm install` / Docker 构建时按平台下载，不再依赖 `plugins.tar.gz`；`plugins.tar.gz` 现仅承载 yt-dlp。桌面版 `ci/download-3pp-binary.sh` 同样从这两个包复制（win-arm64 例外，直接下载 BtbN winarm64 构建）。

- 对应标签的镜像已存在于 GHCR 时，CI 直接复用，**不会重新下载**外部二进制。
- 升级某个 3pp：修改 `package.json` 中对应版本号 → 标签变化 → CI 重新构建该镜像。
- 单独构建某个 3pp 镜像（3pp 软件发布新版本号时，只构建该软件的镜像，不动 cli/ui、不组装 `smm:latest`）：手动运行对应的 **Build ffmpeg Docker Image** / **Build ytdlp Docker Image** / **Build videocaptioner Docker Image** workflow（Actions 中可各自独立触发）。
- 强制重建（覆盖已有版本标签）：在上述三个 workflow 手动运行时勾选 **Force Build**（`force_build`），或在 `build-docker.yml` / `release-all.yml` 勾选 `force_rebuild_3pp`。

`cli` / `ui` 是应用代码，仍按 commit SHA 打标签，每次提交重建。

### 认证环境变量

| 变量 | 说明 |
|------|------|
| `SMM_AUTH_TOKEN` | API Bearer token。未设置或为空时，CLI 启动会自动生成并打印到日志 |
| `SMM_AUTH_ENABLED` | Docker 镜像默认为 `true`；设为 `false` 可关闭 `/api/*` 的 Bearer 校验 |

UI 从 URL query `token` 或 localStorage `auth-token` 读取 token，并在 HTTP 请求中注入 `Authorization` 头。

本地 Electron / 开发模式默认不启用校验（非 Docker 且未设置 `SMM_AUTH_ENABLED`）。

### 资源路径

所有第三方二进制位于容器内 `/app/resources/bin/`，CLI 通过环境变量 `SMM_RESOURCES_PATH=/app/resources` 自动发现。

## 与 Electron 打包的对应关系

`apps/docker/Dockerfile` 产出的 `smm:latest` 与 `apps/electron/electron-builder.yml` 的 `extraResources` 在二进制布局上一一对应：

| 组件 | Electron extraResources | Docker `/app/resources/bin/` |
|---|---|---|
| ffmpeg | `../../bin/ffmpeg` → `bin/ffmpeg` | `bin/ffmpeg/{ffmpeg,ffprobe}` |
| yt-dlp | `../../bin/yt-dlp/yt-dlp` → `bin/yt-dlp/yt-dlp` | `bin/yt-dlp/yt-dlp` |
| VideoCaptioner | `../../bin/videocaptioner` → `bin/videocaptioner` | `bin/videocaptioner/{videocaptioner,…}` |
| QuickJS | `../../bin/quickjs` → `bin/quickjs` | `bin/quickjs/{qjs,…}` |

CLI 运行时通过 `SMM_RESOURCES_PATH` 在 `/app/resources` 下查找这些二进制。
