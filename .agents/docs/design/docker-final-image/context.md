# Docker Final Image

`apps/docker/` 当前 `Dockerfile` 在同一份构建上下文里依次执行 CLI 构建、UI 构建、第三方二进制下载与最终镜像组装。已完成的两份姊妹中间镜像 `cli.Dockerfile`（仅构建 CLI）和 `ui.Dockerfile`（仅构建 UI）暴露了独立的 `builder` 阶段，可被 `COPY --from=` 复用。

## Goal

改造 `apps/docker/Dockerfile`，**复用 `smm-cli-build:latest` 与 `smm-ui-build:latest` 两个中间镜像**作为构建源，移除原 Dockerfile 中重复的 `node:22-alpine` 构建阶段。最终镜像仅承担"最终组装"职责：

1. 拉取（`FROM` 或 `COPY --from=`）CLI + UI 中间镜像中的产物
2. 下载并放置第三方二进制（ffmpeg / ffprobe / yt-dlp / videocaptioner / quickjs 等）到 `/app/resources/bin/`
3. 设置 `SMM_RESOURCES_PATH`，暴露端口，写入 `ENTRYPOINT` / `CMD`

最终目标：**`pnpm --filter docker build` 跑出来的 `smm:latest` 与原 Dockerfile 行为完全等价**（CLI 可执行文件路径、UI 静态资源路径、`/app/resources/bin/` 下二进制布局、`SMM_RESOURCES_PATH` 默认值、监听端口、`tini` 入口），但构建时间显著缩短（中间镜像可缓存复用，且不再为最终镜像重复构建 CLI / UI）。

## Codebase Analysis

### 当前 Dockerfile 现状

`apps/docker/Dockerfile`（截至 2026-06-26）的关键阶段：

| Stage | 内容 | 时长 / 体积 |
|---|---|---|
| `builder` (node:22-alpine) | corepack + pnpm + bun，`pnpm install --frozen-lockfile --filter cli... --filter ui...`，`pnpm --filter cli build && pnpm --filter ui build` | **~5min**（pnpm 安装 + 双 app 构建） |
| `debian:bookworm-slim` | 安装 ca-certificates / wget / curl / tar / bash / nodejs / tini；`COPY --from=builder` 取 CLI 和 UI；`bash ci/download-3pp-binary.sh` 下载 3pp；`mv bin /app/resources/` | 中 |

### 中间镜像的产物约定

| 中间镜像 | 产物位置 | 来源 |
|---|---|---|
| `smm-cli-build:latest` | `/app/cli`（单文件 Linux ELF，可执行） | `cli.Dockerfile` 设计 §3 |
| `smm-ui-build:latest` | `/`（Vite dist，根目录 `index.html` + `assets/`） | `ui.Dockerfile` 设计 §3 |

二者均基于 `scratch`，无运行时依赖。下游 `COPY --from=` 时只需指定路径。

### CLI 启动参数

`apps/cli`（参考 `apps/docker/Dockerfile` 的 `CMD` 与 `apps/docker/README.md`）：

```bash
/app/cli --staticDir /app/public --port 30000
```

- `--staticDir /app/public`：UI 静态资源固定路径
- `--port 30000`：HTTP 监听端口；镜像内 `EXPOSE 30000`
- 环境变量 `SMM_RESOURCES_PATH=/app/resources` 供 `apps/cli/src/utils/Ffmpeg.ts` 等模块查找 `bin/ffmpeg` / `bin/yt-dlp` / `bin/videocaptioner` / `bin/quickjs`

### 第三方二进制（`ci/download-3pp-binary.sh`）

脚本读取 `PLATFORM` / `ARCH` 环境变量，从 GitHub Releases 下载三类资产，安装到仓库根 `bin/`：

| 目录 | 内容 |
|---|---|
| `bin/ffmpeg/` | `ffmpeg`、`ffprobe`（Linux 无后缀） |
| `bin/yt-dlp/` | `yt-dlp`（Linux 无后缀） |
| `bin/videocaptioner/` | `videocaptioner`（Linux 无后缀） |
| `bin/quickjs/` | `qjs` 等 QuickJS 静态构建文件 |

原 Dockerfile 的 `final stage` 执行此脚本后用 `mv bin /app/resources/`。**`bin/` 来自 `.dockerignore` 排除项之外**：`.dockerignore` 在 `bin/` 上加了排除规则，原因是 `bin/` 在 Docker 流程中由 CI 重新生成；但 `download-3pp-binary.sh` 在 `final stage` 内运行时需要的只是网络与 tar / unzip，与 build 上下文的 `bin/` 无关——脚本目标路径是 `bin/`（仓库根相对路径），因此最终阶段需要 `WORKDIR /build` 让脚本找到仓库根布局。

> ⚠️ 关键约束：脚本 `SCRIPT_DIR` / `REPO_ROOT` 用 `bash -- "$(dirname -- "${BASH_SOURCE[0]}")"` 计算相对路径。`BASH_SOURCE` 指向脚本在镜像中的位置——脚本在 final stage 中必须仍位于 `ci/download-3pp-binary.sh`，**否则脚本会因找不到自身而计算错误的 `REPO_ROOT`**。从原 Dockerfile 看：脚本由 `COPY ci/download-3pp-binary.sh /build/ci/download-3pp-binary.sh` 引入，`bash ci/download-3pp-binary.sh` 在 `/build` 工作目录下执行。

### 端口、入口与运行时

- `EXPOSE 30000`
- `ENTRYPOINT ["/usr/local/bin/tini", "--"]` — 信号转发 / PID 1
- `CMD ["/app/cli", "--staticDir", "/app/public", "--port", "30000"]`
- `tini` 从 `https://github.com/krallin/tini/releases/download/v0.19.0/tini-${TINI_ARCH}` 下载，按 `TARGETARCH`（`amd64` / `arm64`）选二进制
- `nodejs` 通过 NodeSource 安装（CLI 是 Bun 编译单文件，但仍需 Node 22 运行时以满足某些 core-routes 依赖）
- `ENV NODE_ENV=production`、`ENV SMM_RESOURCES_PATH=/app/resources`

### 关键约束

- **构建上下文仍为仓库根**：`FROM smm-cli-build:latest` / `FROM smm-ui-build:latest` 不需要上下文，但 `COPY ci/download-3pp-binary.sh /build/ci/...` 与 stub 占位仍依赖仓库根布局
- **中间镜像依赖前置条件**：执行 `pnpm --filter docker build` 之前必须先构建 `smm-cli-build:latest` 与 `smm-ui-build:latest`。可用 `docker buildx` 的多目标 / `--build-context` 串联，但本设计采用**"显式前置 + pnpm 脚本依赖"**的最简单路线
- **`bin/` 仍是脚本的输出目标**：原 Dockerfile 在 final stage 跑 `download-3pp-binary.sh` 后用 `mv bin /app/resources/`。新结构同样可行
- **`scratch` 中间镜像与 `debian:bookworm-slim` 最终镜像的角色分离**：原 `Dockerfile` 把所有事情塞进一个 builder + 一个 final；新结构拆为「CLI builder」「UI builder」「final assembler」三层

## References

- [apps/docker/Dockerfile](../../../apps/docker/Dockerfile) — 现有 Dockerfile（被替换）
- [apps/docker/cli.Dockerfile](../../../apps/docker/cli.Dockerfile) — CLI-only 中间镜像
- [apps/docker/ui.Dockerfile](../../../apps/docker/ui.Dockerfile) — UI-only 中间镜像
- [apps/docker/package.json](../../../apps/docker/package.json) — pnpm 脚本
- [apps/docker/README.md](../../../apps/docker/README.md) — 用户文档（构建/运行说明）
- [apps/docker/docs/development-plan.md](../../../apps/docker/docs/development-plan.md) — Docker 开发计划
- [ci/download-3pp-binary.sh](../../../ci/download-3pp-binary.sh) — 第三方二进制下载脚本
- [.dockerignore](../../../.dockerignore) — 构建上下文排除规则
- [.agents/docs/design/docker-cli-build/](../docker-cli-build/design.md) — CLI 中间镜像设计
- [.agents/docs/design/docker-ui-build/](../docker-ui-build/design.md) — UI 中间镜像设计
- [.agents/docs/design/docker-authentication/](../docker-authentication/design.md) — Docker 认证（最终阶段需保留 `SMM_AUTH_TOKEN` / `SMM_AUTH_ENABLED` 文档）