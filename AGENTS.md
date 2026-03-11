# SMM

本项目为多媒体管理桌面应用. 
项目基于 monorepo 管理, 使用 pnpm 作为包管理器.

## 项目结构

### Packages (共享包)

| 包名 | 描述 |
|------|------|
| **packages/core** | 浏览器和 Node.js 端通用的核心代码, 包含类型定义、路径处理、媒体元数据、用户配置等 |
| **packages/test** | 测试工具包, 提供测试相关的工具函数 |
| **packages/utils** | 通用工具包, 提供通用工具函数 |

### Apps (应用)

| 应用 | 描述 |
|------|------|
| **apps/ui** | 前端应用, 基于 React 19 + Tailwind CSS 4 + Shadcn UI + Vite 7 |
| **apps/cli** | 后端服务, 基于 Bun + Hono + Socket.IO |
| **apps/electron** | Electron 桌面应用, 将 ui 和 cli 打包成桌面应用 |
| **apps/e2e** | 端到端测试, 基于 WebdriverIO |
| **apps/docker** | Docker 镜像构建配置 |

## 核心模块详解

### packages/core
- `path.ts` - 路径处理工具函数
- `uri.ts` - URI 处理工具函数
- `url.ts` - URL 处理工具函数
- `mediaMetadata.ts` - 媒体元数据类型和工具
- `userConfig.ts` - 用户配置管理
- `errors.ts` - 错误类型定义
- `event-types.ts` - 事件类型定义
- `types/` - 类型定义文件
  - `plan.ts` - 计划类型
  - `RenameFilesPlan.ts` - 重命名计划
  - `RecognizeMediaFilePlan.ts` - 识别媒体文件计划
  - `GetEpisodesToolTypes.ts` - 获取剧集工具类型

### apps/ui
前端应用, 主要目录结构:
- `src/api/` - API 调用层
- `src/components/` - UI 组件
  - `dialogs/` - 对话框组件
  - `sidebar/` - 侧边栏组件
  - `ui/` - Shadcn UI 组件
  - `background-jobs/` - 后台任务组件
  - `mcp/` - MCP 相关组件
- `src/ai/` - AI 助手相关代码
- `src/actions/` - 状态操作
- `public/locales/` - 多语言文件 (en, zh-CN, zh-HK, zh-TW)

技术栈:
- React 19
- Tailwind CSS 4
- Shadcn UI (Radix UI)
- Vite 7
- Zustand (状态管理)
- Socket.IO Client
- AI SDK (@ai-sdk/react, @assistant-ui/react)

Shadcn UI 的 cli 对 monorepo 的支持不友好, 无法通过 cli 安装组件.
请手动安装组件, 并在 `apps/ui/src/components/ui/` 目录下创建对应的组件文件.

### apps/cli
后端服务, 主要目录结构:
- `src/route/` - HTTP API 路由
  - `ffmpeg/` - FFmpeg 相关 API (转换、截图)
  - `mediaMetadata/` - 媒体元数据 API
  - `ytdlp/` - yt-dlp 相关 API (下载、提取数据)
- `src/tools/` - 业务工具函数
- `src/mcp/` - MCP (Model Context Protocol) 服务器
  - `tools/` - MCP 工具定义
- `src/utils/` - 工具函数
- `src/validations/` - 验证逻辑
- `src/events/` - Socket.IO 事件处理
- `src/i18n/` - 国际化配置

技术栈:
- Bun (运行时)
- Hono (Web 框架)
- Socket.IO (实时通信)
- MCP SDK (@modelcontextprotocol/sdk)
- AI SDK (@ai-sdk/openai)
- Pino (日志)

### apps/electron
Electron 桌面应用, 主要目录结构:
- `src/main/` - 主进程代码
- `src/preload/` - 预加载脚本
- `src/renderer/` - 渲染进程入口
- `build/` - 构建资源 (图标等)

技术栈:
- Electron 39
- electron-vite
- electron-builder

### apps/e2e
端到端测试, 主要目录结构:
- `test/specs/` - 测试用例
- `test/pageobjects/` - 页面对象
- `test/componentobjects/` - 组件对象
- `test/lib/` - 测试工具

技术栈:
- WebdriverIO 9
- Mocha

## 常用命令

```bash
# 开发
pnpm dev              # 同时启动 ui 和 cli 开发服务器
pnpm dev:ui           # 启动 ui 开发服务器
pnpm dev:cli          # 启动 cli 开发服务器
pnpm dev:electron     # 启动 Electron 开发模式

# 构建
pnpm build            # 构建 cli 和 ui
pnpm build:electron   # 构建 Electron 应用

# 测试
pnpm test             # 运行所有测试
pnpm test:core        # 运行 core 测试
pnpm test:cli         # 运行 cli 测试
pnpm test:ui          # 运行 ui 测试
pnpm test:e2e         # 运行 e2e 测试

# 类型检查
pnpm typecheck        # 运行所有类型检查

# CI
pnpm ci               # 构建 + 测试 + 类型检查
```

## 开发原则

### UI 乐观更新策略

为了提供最佳的 UX, 本应用假设后台操作总是会成功. 开发者应该:
1. 先更新UI状态
2. 执行后台操作(异步计算, API 调用, 等待回调等)
3. 如果后台操作失败, 回滚UI状态, 并弹出合适的错误提示

### 开发阶段

本项目定义了如下开发阶段

**功能探索** 该阶段开发者对新功能没有完整的技术图景, 开发时专注于快速实现功能, 并交付测试. 不需要写单元测试, 不需要 typecheck.
**功能交付** 该阶段开发者对新功能有确定的需求, 开发时需要考虑代码质量, 并编写单元测试.

### 核心术语

**媒体文件夹(Media Folder)** 保存了电视剧, 动画, 电影或音乐的本地文件夹
**媒体库(Media Library)** 保存了多个媒体文件夹的文件夹
**识别多媒体文件夹(Recognize Media Folder)**: 该操作用于指定文件夹保存的是哪一部电视剧或电影的视频文件
**识别季集视频文件(Recognize Episode Video File)**: 该操作用于指定电视剧每一集对应的本地视频文件
**元数据(Media Metadata)**: 元数据, 保存了文件夹对应的电视剧或电影的信息，以及本地视频文件和季集的对应关系
**视频文件和关联文件(Video File and Associated Files)** 视频文件通常还对应着字幕文件, 音频文件, 封面文件和 NFO 文件等, 这类文件被称为关联文件

## 技术架构

### 前后端通信
- **HTTP API**: 使用 Hono 框架提供 RESTful API
- **Socket.IO**: 使用 Socket.IO 进行实时双向通信
- **MCP**: 提供 Model Context Protocol 服务器, 支持 AI 工具调用

### AI 集成
- 前端使用 `@assistant-ui/react` 提供 AI 对话界面
- 后端使用 `@ai-sdk/openai` 集成 OpenAI API
- MCP 服务器提供工具调用能力

### 媒体处理
- **FFmpeg**: 视频转换、截图
- **yt-dlp**: 视频下载
- **TMDB**: 媒体信息搜索和获取
- **NFO**: 媒体元数据文件读写

### 国际化
- 前端使用 `i18next` + `react-i18next`
- 后端使用 `i18next` + `i18next-fs-backend`
- 支持语言: English, 简体中文, 繁体中文(香港), 繁体中文(台湾)
