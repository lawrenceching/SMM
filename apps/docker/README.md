# apps/docker

SMM Docker 镜像构建 workspace。镜像包含：

- **CLI**：`apps/cli` 的 Linux 可执行文件
- **UI**：`apps/ui` 的前端静态资源
- **bin**：ffmpeg、ffprobe、yt-dlp 等第三方可执行文件（Linux 版）

## 开发计划

详见 [docs/development-plan.md](./docs/development-plan.md)。

## 构建与运行

在仓库根目录或本目录下执行：

```bash
# 在 apps/docker 下
pnpm run build

# 或从仓库根
docker build -f apps/docker/Dockerfile -t smm:latest .
```

运行镜像（示例）：

```bash
docker run --rm -p 30000:30000 smm:latest
```

浏览器访问 `http://localhost:30000`。

## 与 Electron 打包的对应关系

与 `apps/electron/electron-builder.yml` 的 `extraResources` 对应：CLI、UI、bin 的用途一致，Docker 使用 Linux 版可执行文件并通过 `SMM_RESOURCES_PATH` 供 CLI 发现。
