# Docker CLI Build

`apps/docker/Dockerfile` 当前把 CLI + UI + 第三方二进制（ffmpeg, yt-dlp 等）打包为一个完整可运行的 Docker 镜像。下游某些 Docker 流水线只需要 CLI 的 Linux 可执行文件，不想顺带把 UI 静态产物或第三方二进制一起拉过来。

## Goal

创建 `apps/docker/cli.Dockerfile`，**仅构建 `apps/cli`**，最终产物为单文件可执行 `dist/cli`，放置在镜像固定路径下供下游 `COPY --from=` 引用。

该镜像作为**中间镜像**（intermediate image）使用：
- **不需要可独立运行**（不下载 ffmpeg / yt-dlp / 不暴露端口 / 不写 ENTRYPOINT）
- **不需要包含 UI 静态资源**
- 输出位置固定：Linux 可执行文件位于镜像的固定路径（见 §"Output 路径"），下游 `Dockerfile` 通过 `COPY --from=` 取出

## Codebase Analysis

### CLI 构建流程

`apps/cli` 的 `pnpm build` 实际执行 `apps/cli/scripts/build.ts`：
1. 读取 `apps/cli/package.json` 的 `version` 字段，生成 `apps/cli/src/version.ts`
2. 调用 `bun build index.ts --compile --outfile dist/cli`，产出单文件二进制

可选：通过环境变量 `CLI_COMPILE_TARGET` 跨平台编译（例如 CI 在 x64 上打 `bun-linux-arm64`）。Docker 构建场景在 `linux/amd64` 和 `linux/arm64` 主机上使用默认行为即可。

### 工作区依赖

`apps/cli` 依赖两个 workspace 包（`package.json` 的 `dependencies`）：

| 包 | 导入方式 |
|---|---|
| `packages/core-routes` | `package.json` → `"@smm/core-routes": "workspace:*"` |
| `packages/tvdb4` | `package.json` → `"@smm/tvdb4": "workspace:*"` |

间接 workspace 依赖（`@smm/core-routes` 内部再依赖 `packages/core`）—— pnpm workspace 解析时也会被拉入。

`apps/cli/tsconfig.json` 的 `paths` 还把 `packages/test` 列在 import map 里（虽然 CLI 运行时不会用），但仅作为 TS 提示，不会强制打包进 bun 的可执行文件。CI 保险起见仍把 `packages/test` 复制进镜像以满足 TS 编译检查。

pnpm workspace 解析要求 `pnpm-workspace.yaml` 列出的所有成员都存在 `package.json`。不参与构建的成员用 `ci/docker/pnpm-stubs/` 下的 stub `package.json` 占位（已有先例，见 `ui.Dockerfile`）。

### 关键约束

- **Bun 编译依赖**：`bun build --compile` 需要 `bun` 运行时本身（仅需 builder 阶段）
- **目标平台**：当前 Docker 镜像发布 `linux/amd64` + `linux/arm64`（参见现有 `Dockerfile` 的 `TARGETARCH` 分支）。`bun build --compile` 默认产物匹配构建主机架构；多架构需要 Docker Buildx + QEMU，或者在 build arg 中显式指定 `CLI_COMPILE_TARGET`
- **Output 路径**：参考 `Dockerfile` 的 `COPY --from=builder /build/apps/cli/dist/cli /app/cli`，镜像内可执行文件位于 `/build/apps/cli/dist/cli`（在 builder 阶段的工作目录 `/build` 下）
- **中间镜像特征**：没有 `EXPOSE` / `ENTRYPOINT` / `CMD`，使用 `scratch` 作为 final stage，最小化层大小

## References

- [apps/docker/Dockerfile](../../../apps/docker/Dockerfile) — 现有完整 Docker 构建
- [apps/docker/ui.Dockerfile](../../../apps/docker/ui.Dockerfile) — UI-only 中间镜像（结构先例）
- [apps/docker/docs/development-plan.md](../../../apps/docker/docs/development-plan.md) — Docker 开发计划
- [apps/cli/scripts/build.ts](../../../apps/cli/scripts/build.ts) — CLI 构建脚本（生成 version.ts + bun --compile）
- [apps/cli/package.json](../../../apps/cli/package.json) — CLI workspace 依赖
- [apps/cli/tsconfig.json](../../../apps/cli/tsconfig.json) — CLI TS 编译配置
- [ci/docker/pnpm-stubs/](../../../ci/docker/pnpm-stubs/) — workspace 占位 stub
- [.dockerignore](../../../.dockerignore) — 构建上下文忽略规则
- [相关 design：docker-ui-build](../docker-ui-build/context.md) — UI-only 中间镜像
