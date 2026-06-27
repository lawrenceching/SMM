# Docker UI Build

`apps/docker/` 现有 `Dockerfile` 将 CLI + UI + 第三方二进制（ffmpeg, yt-dlp 等）打包为一个完整可运行的 Docker 镜像。其他构建流程（如 E2E 测试镜像、Electron 打包流水线）可能只需要前端静态产物，不想引入完整的 CLI 运行时和二进制依赖。

## Goal

创建 `apps/docker/ui.Dockerfile`，**仅构建 `apps/ui` 前端**，最终镜像在 `/` 根目录存放 Vite 构建产物（HTML, JS, CSS, assets）。

该镜像作为**中间镜像**（intermediate / base image）供下游 Dockerfile 通过 `COPY --from=` 引用，**不需要可独立运行**。

## Codebase Analysis

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  apps/docker/ui.Dockerfile (NEW)                         │
│                                                          │
│  Builder Stage (node:22-alpine)                          │
│  ├─ pnpm install --filter ui...                         │
│  └─ pnpm --filter ui build                              │
│                                                          │
│  Output Stage (scratch)                                  │
│  └─ COPY --from=builder /build/apps/ui/dist/ → /        │
└──────────────────────────────────────────────────────────┘
        │
        │  COPY --from=smm-ui-build / /app/public/
        ▼
┌──────────────────────────────────────────────────────────┐
│  Downstream Dockerfile (e.g. apps/docker/Dockerfile)     │
│  └─ COPY --from=smm-ui-build / /app/public/              │
└──────────────────────────────────────────────────────────┘
```

### 依赖图

`apps/ui` 构建依赖两个 workspace 包：

| 包 | 依赖方式 |
|---|---|
| `packages/core` | `tsconfig.json` paths alias (`@core/*`, `@smm/core`, `@smm/core/*`) |
| `packages/tvdb4` | `package.json` → `"@smm/tvdb4": "workspace:*"` |

无传递 workspace 依赖（`packages/core` 和 `packages/tvdb4` 均无 workspace dep）。

pnpm workspace 解析要求所有 `pnpm-workspace.yaml` 声明的成员都存在 `package.json`。不需实际构建的成员使用 `ci/docker/pnpm-stubs/` 下的 stub `package.json` 占位。

### 关键配置

- **`.dockerignore`**：排除 `node_modules/`, `dist/`, `apps/ohos/`, `apps/electron/` 等，构建上下文干净
- **Vite 构建**：`apps/ui` 使用 `vite build`（含 `tsc -b`），产物输出到 `apps/ui/dist/`
- **构建上下文**：仓库根目录（与现有 Dockerfile 一致）

## References

- [apps/docker/Dockerfile](../../../apps/docker/Dockerfile) — 现有完整 Docker 构建
- [apps/docker/docs/development-plan.md](../../../apps/docker/docs/development-plan.md) — Docker 开发计划
- [.dockerignore](../../../.dockerignore) — Docker 构建忽略规则
- [.agents/docs/architecture.md](../../architecture.md) — 项目架构
