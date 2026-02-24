# 打包外部可执行文件（yt-dlp / ffmpeg / ffprobe）开发计划

## 1. 现状与目标

### 1.1 现状

- **electron-builder**（`electron-builder.yml`）已通过 `extraResources` 打包：
  - `../cli/dist/cli.exe` → `resources/cli.exe`
  - `../ui/dist` → `resources/public`
- **CLI 发现逻辑**（`apps/cli/src/utils/Ffmpeg.ts`、`Ytdlp.ts`）依次查找：
  1. 用户配置路径（`ffmpegExecutablePath` / `ytdlpExecutablePath`）
  2. 项目根目录下的 `bin/ffmpeg/ffmpeg.exe`、`bin/yt-dlp/yt-dlp.exe`（开发用）
  3. **安装数据目录**下的 `bin/ffmpeg/ffmpeg.exe`、`bin/yt-dlp/yt-dlp.exe`
     - Windows: `%LOCALAPPDATA%\SMM`
     - macOS: `~/Library/Application Support/SMM`
     - Linux: `~/.local/share/SMM`
- **仓库中已有二进制**：`bin/ffmpeg/ffmpeg.exe`、`bin/ffmpeg/ffprobe.exe`、`bin/yt-dlp/yt-dlp.exe`（当前为 Windows）。
- **Electron 主进程** 启动 CLI 时通过 `process.resourcesPath` 定位 `cli.exe` 和 `public`，未传递“应用 resources 路径”给 CLI，因此 CLI 无法直接使用“随包安装的 bin”。

### 1.2 目标

- 将 **yt-dlp**、**ffmpeg**、**ffprobe** 随 Electron 安装包一起分发，无需用户自行安装或配置路径。
- 打包后 CLI 优先使用应用内嵌的 bin，仅在用户配置了自定义路径时使用用户路径。

---

## 2. 方案概述

- **打包**：用 electron-builder 的 `extraResources` 把 `bin/ffmpeg/`、`bin/yt-dlp/` 放入应用 `resources`（例如 `resources/bin/ffmpeg/`、`resources/bin/yt-dlp/`）。
- **发现**：CLI 在“用户配置”之后、“项目根 / 安装数据目录”之前，增加一步：若存在环境变量 `SMM_RESOURCES_PATH`，则先在该路径下的 `bin/ffmpeg/`、`bin/yt-dlp/` 中查找可执行文件。
- **Electron**：在启动 CLI 时设置 `SMM_RESOURCES_PATH = process.resourcesPath`，使 CLI 使用随包安装的 bin。

这样无需在首次启动时复制文件到 `smmDataDir`，也无需改用户数据目录结构；多平台时只需在 builder 中按平台选择不同二进制（见 5.2）。

---

## 3. 任务拆解

### 3.1 修改 electron-builder 配置（apps/electron）

- 在 `electron-builder.yml` 的 `extraResources` 中增加：
  - `bin/ffmpeg`：从仓库根目录的 `bin/ffmpeg` 复制到 resources 的 `bin/ffmpeg`（包含 `ffmpeg.exe`、`ffprobe.exe`）。
  - `bin/yt-dlp`：从仓库根目录的 `bin/yt-dlp` 复制到 resources 的 `bin/yt-dlp`（包含 `yt-dlp.exe`）。
- 路径说明：配置文件在 `apps/electron/electron-builder.yml`，仓库根为 `../..`，故：
  - `from: '../../bin/ffmpeg'`，`to: 'bin/ffmpeg'`
  - `from: '../../bin/yt-dlp'`，`to: 'bin/yt-dlp'`
- 使用 `filter` 只包含需要的可执行文件，避免把 `.gitkeep` 等打进包；若需按平台区分（如仅 Windows 打 .exe），可用 electron-builder 的 `filter` 或后续按平台拆分配置。

### 3.2 Electron 主进程传递 resources 路径

- 在 `apps/electron/src/main/index.ts` 中，`startCLI()` 里 `spawn(CLI_EXECUTABLE, cliArgs, { env: { ... } })` 的 `env` 中增加：
  - `SMM_RESOURCES_PATH: process.resourcesPath`（仅在生产模式设置；开发模式可不设或设为开发时的 resources 路径，视需要而定）。
- 确保仅在 `!is.dev` 时设置，避免开发时覆盖本地 bin 行为。

### 3.3 CLI 发现逻辑：支持 SMM_RESOURCES_PATH

- **Ffmpeg.ts**
  - 在 `discoverFfmpeg()` 中，在“用户配置”检查之后、`getProjectRoot()` 之前：
    - 若 `process.env.SMM_RESOURCES_PATH` 存在，则检查  
      `path.join(process.env.SMM_RESOURCES_PATH, 'bin', 'ffmpeg', 'ffmpeg.exe')`（Windows）；  
      若存在则返回该路径。
  - 保持原有“项目根”“smmDataDir”顺序不变。
- **Ytdlp.ts**
  - 在 `discoverYtdlp()` 中同样增加一步：若 `SMM_RESOURCES_PATH` 存在，则检查  
    `path.join(process.env.SMM_RESOURCES_PATH, 'bin', 'yt-dlp', 'yt-dlp.exe')`（Windows）；  
    若存在则返回。
- **跨平台**：当前代码与仓库 bin 均为 Windows（.exe）。后续若支持 macOS/Linux，可在此处根据 `process.platform` 选择可执行文件名（如 `ffmpeg` / `yt-dlp` 无后缀），并在 3.1 中按平台打包对应二进制。

### 3.4 ffprobe 的用途与打包

- 当前代码中未发现对 ffprobe 的调用（视频时长、截图、转换均使用 ffmpeg）。
- 计划中仍将 **ffprobe** 随 **ffmpeg** 一起打包到 `bin/ffmpeg/`，便于后续如需用 ffprobe 做元数据/探测时直接可用；无需改发现逻辑，除非将来增加“ffprobe 专用发现函数”。

### 3.5 文档与 .gitignore

- 更新 `apps/cli/docs/Ytdlp.md`（及如有 Ffmpeg 文档）：在“发现顺序”中增加一条：当运行在 Electron 打包环境下时，会优先使用 `SMM_RESOURCES_PATH/bin/...` 下的可执行文件（若已设置 `SMM_RESOURCES_PATH`）。
- `apps/electron/.gitignore` 中已有 `resources/bin/*`，用于忽略本地开发时可能生成的 `resources/bin`，与“通过 extraResources 从仓库 bin 打进包”不冲突；无需修改。

### 3.6 构建与验证

- 在 Windows 上执行一次完整打包（如 `pnpm run build:win` 或 `build:unpack`），确认：
  - `resources/bin/ffmpeg/ffmpeg.exe`、`resources/bin/ffmpeg/ffprobe.exe`、`resources/bin/yt-dlp/yt-dlp.exe` 存在于安装目录（或 unpack 目录）的 resources 下。
  - 启动应用后，设置页或依赖 ffmpeg/yt-dlp 的功能能正确发现并使用内嵌版本（不配置用户路径时）。
- 可选：在 CI 或本地增加简单检查（如打包后列出 `resources/bin` 并断言关键文件存在）。

---

## 4. 实施顺序建议

| 步骤 | 任务 | 说明 |
|------|------|------|
| 1 | 修改 `electron-builder.yml`，增加 bin 的 extraResources | 先保证包内能看到 bin |
| 2 | Electron 主进程在 spawn CLI 时设置 `SMM_RESOURCES_PATH` | 让 CLI 知道 resources 路径 |
| 3 | CLI：Ffmpeg.ts / Ytdlp.ts 增加基于 SMM_RESOURCES_PATH 的发现 | 使内嵌 bin 被优先使用 |
| 4 | 打包并手动验证 | 确认行为符合预期 |
| 5 | 更新 CLI 文档（Ytdlp / Ffmpeg 发现顺序） | 便于后续维护 |

---

## 5. 后续可选项

- **多平台**：为 macOS/Linux 准备无 `.exe` 后缀的 ffmpeg/ffprobe/yt-dlp，在 extraResources 中按 `process.platform` 或 electron-builder 的 platform 做 filter，并在发现逻辑里按 `os.platform()` 选择文件名。
- **首次启动拷贝到 smmDataDir**：若希望“用户可替换 bin”且不依赖 resources 只读目录，可在首次启动时把 resources 下的 bin 拷贝到 smmDataDir，并保持当前“安装路径”发现逻辑；本方案未采用该方式以简化实现并避免写入用户目录。
- **版本/完整性**：若有需要，可在关于页或设置页显示内嵌 ffmpeg/yt-dlp 版本；可选增加校验（如文件存在性、最小版本）并在缺失时提示。

---

## 6. 小结

- 通过 **extraResources** 把 `bin/ffmpeg`（ffmpeg + ffprobe）和 `bin/yt-dlp` 打进 Electron 的 resources。
- 通过 **SMM_RESOURCES_PATH** 让 CLI 在“用户配置”之后优先使用 resources 下的 bin。
- 改动集中在：`electron-builder.yml`、`apps/electron/src/main/index.ts`、`apps/cli/src/utils/Ffmpeg.ts`、`apps/cli/src/utils/Ytdlp.ts`，以及文档与验证。

按上述顺序实施即可完成“打包 yt-dlp、ffmpeg、ffprobe 可执行文件”的定制开发。
