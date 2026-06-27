# apps/docker

SMM Docker 镜像构建 workspace。镜像包含：

- **CLI**：`apps/cli` 的 Linux 可执行文件（glibc）
- **UI**：`apps/ui` 的前端静态资源
- **bin**：ffmpeg、ffprobe、yt-dlp、VideoCaptioner、QuickJS 等第三方可执行文件（Linux 版）

最终镜像基于 `debian:bookworm-slim`，与 `cli.Dockerfile`（同在 Debian 编译，产出 glibc CLI）及 3pp 二进制（ffmpeg / yt-dlp 等均为 glibc 链接）保持 ABI 一致。

## 开发计划

详见 [docs/development-plan.md](./docs/development-plan.md)。

## 构建与运行

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
