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
docker run --rm -p 30000:30000 \
  -e SMM_AUTH_ENABLED=true \
  -e SMM_AUTH_TOKEN=your-secret-token \
  smm:latest
```

浏览器访问 `http://localhost:30000/?token=your-secret-token`。

### 认证环境变量

| 变量 | 说明 |
|------|------|
| `SMM_AUTH_TOKEN` | API Bearer token。未设置或为空时，CLI 启动会自动生成并打印到日志 |
| `SMM_AUTH_ENABLED` | 设为 `true` 时，所有 `/api/*` 请求必须携带 `Authorization: Bearer <token>` |

UI 从 URL query `token` 或 localStorage `auth-token` 读取 token，并在 HTTP 请求中注入 `Authorization` 头。

本地 Electron / 开发模式默认不启用校验（未设置 `SMM_AUTH_ENABLED`）。

## 与 Electron 打包的对应关系

与 `apps/electron/electron-builder.yml` 的 `extraResources` 对应：CLI、UI、bin 的用途一致，Docker 使用 Linux 版可执行文件并通过 `SMM_RESOURCES_PATH` 供 CLI 发现。
