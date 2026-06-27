# Docker 3PP Binary Images

`apps/docker/` 已经完成了 CLI、UI 的中间镜像拆分（`cli.Dockerfile` / `ui.Dockerfile`），但第三方二进制（3pp）仍然缺失——最终镜像 `smm:latest` 不包含 ffmpeg / yt-dlp / videocaptioner / quickjs。

## Goal

为四个 3pp 组件创建独立的中间镜像，各自输出到标准路径 `/app/resources/bin/<component>/`。最终 Dockerfile 通过 `COPY --from=` 拉取所有中间镜像的产物，从而恢复 `SMM_RESOURCES_PATH` 功能。

## 设计原则

- **每个组件一个 Dockerfile**：ffmpeg、yt-dlp、videocaptioner 各一份；quickjs 因来源稳定且变动频率极低，合并到 ffmpeg.Dockerfile 中。
- **独立升级**：更新 yt-dlp 版本只需重新构建 `ytdlp.Dockerfile`，不影响其他组件。
- **多架构**：每个 Dockerfile 接收 `ARG TARGETARCH`，在 builder 阶段按架构选择正确的二进制。
- **极小输出**：输出阶段使用 `FROM scratch`，仅包含目标二进制文件。
- **版本可覆写**：每个 Dockerfile 声明对应组件的 `ARG VERSION` / `ARG REPO`，构建时可传入不同值。

## Source of truth

`ci/download-3pp-binary.sh` 是 3pp 下载的唯一来源。每个 Dockerfile 仅复制该脚本中对应组件的下载/提取逻辑。

### plugins.tar.gz 内部布局

```
plugins/
├── ffmpeg-linux64/{ffmpeg,ffprobe,ffplay,…}    # amd64
├── ffmpeg-linuxarm64/{ffmpeg,ffprobe,ffplay,…} # arm64
├── yt-dlp_linux                                  # amd64
└── yt-dlp_linux_aarch64                          # arm64
```

### 组件依赖关系

| 组件 | 来源 | 架构映射 | 输出路径 |
|---|---|---|---|
| ffmpeg + ffprobe | `plugins.tar.gz::ffmpeg-linux{64,arm64}/` | `amd64`→`ffmpeg-linux64`, `arm64`→`ffmpeg-linuxarm64` | `/app/resources/bin/ffmpeg/` |
| yt-dlp | `plugins.tar.gz::yt-dlp_linux{,_aarch64}` | `amd64`→`yt-dlp_linux`, `arm64`→`yt-dlp_linux_aarch64` | `/app/resources/bin/yt-dlp/` |
| VideoCaptioner | `releases/videocaptioner-{version}-linux-{x64,arm64}.tar.gz` | `amd64`→`linux-x64`, `arm64`→`linux-arm64` | `/app/resources/bin/videocaptioner/` |
| QuickJS | `bellard.org/quickjs/binary_releases/quickjs-*.zip` | `amd64`→`linux-x86_64`, `arm64`→`cosmo` | `/app/resources/bin/quickjs/` |

## Consumers

- `apps/docker/Dockerfile`（最终镜像）：`COPY --from=` 三个中间镜像 → `/app/resources/`
- `apps/cli`：通过 `SMM_RESOURCES_PATH=/app/resources` 在运行时发现二进制
- Electron desktop：不受影响（仍从 `apps/electron/electron-builder.yml` 的 `extraResources` 获取）

## References

- [ci/download-3pp-binary.sh](../../../ci/download-3pp-binary.sh)
- [apps/docker/Dockerfile](../../../apps/docker/Dockerfile)（当前版本，不含 3pp）
- [apps/docker/package.json](../../../apps/docker/package.json)
- [.dockerignore](../../../.dockerignore)（排除 `bin/` 和 `plugins/`，不影响 Dockerfile 内部下载）
