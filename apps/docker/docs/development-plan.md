# apps/docker 定制开发计划

## 1. 目标与范围

### 1.1 目标

- 在 monorepo 中建立 **apps/docker** workspace，专门用于构建 SMM 的 Docker 镜像。
- 镜像内容与桌面版（Electron）打包对齐：包含 **CLI 可执行文件**、**UI 前端静态资源**、**bin 目录下的第三方可执行文件**，便于在容器内开箱即用。

### 1.2 与 electron-builder 的对应关系

参考 `apps/electron/electron-builder.yml` 的 `extraResources`：

| 资源           | electron-builder 来源              | electron-builder 目标 | Docker 对应物                     |
|----------------|------------------------------------|------------------------|-----------------------------------|
| CLI            | `../cli/dist/cli.exe`              | `cli.exe`              | `apps/cli/dist/cli`（Linux 单文件）|
| UI             | `../ui/dist`                       | `public`               | `apps/ui/dist` → `/app/public`    |
| ffmpeg         | `../../bin/ffmpeg` (ffmpeg.exe 等)  | `bin/ffmpeg`           | Linux 版 ffmpeg/ffprobe            |
| yt-dlp         | `../../bin/yt-dlp` (yt-dlp.exe)     | `bin/yt-dlp`           | Linux 版 yt-dlp                    |
| openlist       | `../../bin/openlist` (openlist.exe) | `bin/openlist`         | 可选，若 CLI 使用则提供 Linux 版   |

- 仓库中 `bin/` 目前为 **Windows 可执行文件**（.exe），Docker 镜像是 **Linux 环境**，因此 bin 需在镜像内通过系统包或官方 Linux 发行版提供，而不是直接 COPY 仓库 `bin/`。

---

## 2. 需要打包的三大块

### 2.1 apps/cli 可执行文件

- **构建**：在 builder 阶段执行 `pnpm run build`（会执行 `apps/cli` 的 `bun build index.ts --compile --outfile dist/cli`），在 Linux 下得到 **单文件可执行文件** `apps/cli/dist/cli`（无 .exe 后缀）。
- **放入镜像**：复制到例如 `/app/cli`，并 `chmod +x`。
- **运行**：`/app/cli --staticDir /app/public --port 30000`（与现有根目录 Dockerfile 一致）。

### 2.2 apps/ui 前端页面

- **构建**：同一 builder 阶段中 `pnpm run build` 会构建 `apps/ui`，输出在 `apps/ui/dist/`（Vite 静态产物）。
- **放入镜像**：复制到 `/app/public/`，供 CLI 的 `--staticDir` 使用。

### 2.3 bin 目录下的第三方可执行文件（Linux 版）

- **ffmpeg / ffprobe**  
  - 来源：Debian 系可用 `apt-get install -y ffmpeg`，会同时提供 `ffmpeg` 与 `ffprobe`。  
  - 建议：在最终阶段安装，并将可执行文件复制到 `/app/resources/bin/ffmpeg/`（或创建符号链接），以保持与 CLI 发现逻辑一致（见下）。
- **yt-dlp**  
  - 来源：可从 GitHub releases 下载 Linux 二进制，或使用 pip 安装。  
  - 建议：在 Dockerfile 中下载官方 Linux 单文件到 `/app/resources/bin/yt-dlp/yt-dlp`，并 `chmod +x`。
- **openlist**  
  - 当前代码库中未发现 CLI 对 openlist 的调用；electron-builder 已打包 openlist。  
  - 建议：**可选**。若后续 CLI/功能需要 openlist，再在镜像中增加安装或拷贝 Linux 版至 `/app/resources/bin/openlist/`。

CLI 发现逻辑（`apps/cli/src/utils/Ffmpeg.ts`、`Ytdlp.ts`）已支持通过环境变量 **`SMM_RESOURCES_PATH`** 查找 `bin/ffmpeg`、`bin/yt-dlp`（Linux 下使用无 `.exe` 后缀的文件名）。因此只要在运行时设置 `SMM_RESOURCES_PATH=/app/resources`，并将上述可执行文件放在 `/app/resources/bin/ffmpeg/`、`/app/resources/bin/yt-dlp/` 下即可。

---

## 3. 目录与构建方式

### 3.1 目录结构（建议）

```
apps/docker/
├── package.json          # workspace 成员，含 build 等脚本
├── Dockerfile            # 镜像构建文件（构建上下文为仓库根目录）
└── docs/
    └── development-plan.md  # 本开发计划
```

- **构建上下文**：仓库根目录（便于 COPY 整个 monorepo 用于 builder 阶段的 `pnpm install` 与 `pnpm run build`）。
- **构建命令示例**（在仓库根或 apps/docker 下均可）：
  - 在 `apps/docker` 下：`pnpm run build` → 内部执行 `docker buildx build -f Dockerfile ../..`（或等价命令，上下文为 `../..`）。
  - 在仓库根：`docker build -f apps/docker/Dockerfile -t smm:latest .`

### 3.2 Dockerfile 放置策略

- **方案 A（推荐）**：Dockerfile 放在 **apps/docker/Dockerfile**，由 apps/docker 的脚本或根目录脚本通过 `-f apps/docker/Dockerfile` 指定，上下文为仓库根。这样“Docker 相关一切”归在 apps/docker 下，与 electron 的 electron-builder 配置分离清晰。
- **方案 B**：保留根目录 Dockerfile 作为当前简易镜像，apps/docker 仅提供文档与脚本，通过脚本调用根目录 Dockerfile 并传入构建参数。若希望“一个入口、一个 Dockerfile”，可采用方案 A 并逐步弃用根目录 Dockerfile。

---

## 4. 任务拆解与实施顺序

| 步骤 | 任务 | 说明 |
|------|------|------|
| 1 | 创建 apps/docker workspace | 已有 `package.json`，确保 `pnpm-workspace.yaml` 包含 `apps/*`（已包含）。 |
| 2 | 在 apps/docker 下新增 Dockerfile | 以现有根目录 Dockerfile 为基础，构建阶段保持不变（node:22-alpine + pnpm + bun，`pnpm run build`）。 |
| 3 | 最终阶段：复制 cli + public | 从 builder 复制 `apps/cli/dist/cli` → `/app/cli`，`apps/ui/dist` → `/app/public`（与现有一致）。 |
| 4 | 最终阶段：准备 resources/bin | 创建 `/app/resources/bin/ffmpeg`、`/app/resources/bin/yt-dlp`。安装 ffmpeg（apt），下载 yt-dlp Linux 二进制并放入对应目录；必要时为 openlist 预留目录或后续补充。 |
| 5 | 设置 SMM_RESOURCES_PATH | 在 `CMD` 或 `ENTRYPOINT` 之前设置 `ENV SMM_RESOURCES_PATH=/app/resources`，使 CLI 自动发现镜像内 ffmpeg/yt-dlp。 |
| 6 | 根目录脚本与文档 | 根目录 `package.json` 中 `build:docker` 可改为指向 `apps/docker`（例如 `pnpm --filter docker build` 或 `docker build -f apps/docker/Dockerfile .`），并在 README 或 apps/docker/README 中说明如何构建与运行。 |
| 7 | 验收 | 运行镜像后，在设置页或依赖 ffmpeg/yt-dlp 的功能中确认能正确发现并使用镜像内二进制，无需用户配置路径。 |

---

## 5. 技术要点小结

- **CLI**：Linux 下为单文件 `cli`，由 Bun 编译产出，无需 Node 运行时。
- **UI**：纯静态文件，与 Electron 打包的 `resources/public` 一致。
- **bin**：与 Electron 的 `extraResources` 对应，但使用 **Linux 可执行文件**；通过 `SMM_RESOURCES_PATH` 与现有 CLI 发现逻辑对接，无需改 CLI 代码。
- **多阶段构建**：builder 阶段与现有根目录 Dockerfile 一致；仅最终阶段增加“安装/下载 Linux 版 ffmpeg、yt-dlp 并放入 `/app/resources/bin/`”以及设置 `SMM_RESOURCES_PATH`。

---

## 6. 后续可选项

- **多架构**：使用 `docker buildx` 为 amd64/arm64 分别构建或构建 manifest list，并在 Dockerfile 中按 TARGETARCH 选择 ffmpeg/yt-dlp 的下载地址。
- **openlist**：若后续功能需要 openlist，在 Dockerfile 中增加下载/安装步骤，放入 `/app/resources/bin/openlist/`。
- **版本与健康检查**：在镜像中增加版本标签或健康检查（如 `HEALTHCHECK` 调用 `/app/cli` 某接口），便于编排与监控。

按上述顺序实施即可完成 apps/docker 的定制开发，并使 Docker 镜像与 Electron 打包内容在“CLI + UI + bin”三方面对齐。
