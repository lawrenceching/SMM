# SMM

本项目为多媒体管理桌面应用. 
项目基于 monorepo 管理, 使用 pnpm 作为包管理器.

## 项目结构

### Packages (共享包)

| 包名 | 描述 |
|------|------|
| **packages/types** | 跨端共享类型、interface、Zod schema |
| **packages/utils** | 无业务语义纯工具（Path、locale、uri/url 等） |
| **packages/test** | 测试工具包, 提供测试相关的工具函数 |
| **packages/core-routes** | 实现通用 HTTP 接口, `apps/cli`, `apps/electron`, `apps/ohos` 都会复用这些接口 | 

### Apps (应用)

| 应用 | 描述 |
|------|------|
| **apps/ui** | 前端应用, 基于 React 19 + Tailwind CSS 4 + Shadcn UI + Vite 7 |
| **apps/core** | 业务 Core（`@smm/core`），headless 业务逻辑与 Ports 抽象 |
| **apps/cli** | 命令行应用 (`smm`), 基于 Commander。`smm web` 命令启动 apps/server 提供的 HTTP 服务器 |
| **apps/server** | HTTP 服务器纯库, 基于 Bun + Hono + Socket.IO, 由 apps/cli 的 `smm web` 引入 |
| **apps/electron** | Electron 桌面应用, 将 ui 和 cli 打包成桌面应用 |
| **apps/e2e** | 端到端测试, 基于 WebdriverIO |
| **apps/docker** | Docker 镜像构建配置 |
| **apps/ohos** | 鸿蒙 HarmonyOS 应用 |

## 核心模块详解

### packages/types
- 共享 DTO、事件类型、AI tool schema、Job 类型等（`@smm/types`）

### packages/utils
- `path.ts` - 路径处理（`@smm/utils/path`）
- `uri.ts` / `url.ts` - URI/URL 工具
- `locale.ts` / `proxiableFetch.ts` / `errors.ts` 等无业务语义工具

### apps/core（`@smm/core`）
- 业务 Core：媒体元数据、用户配置、AI tool 实现、rename 校验、whitelistedCmd 等
- Ports 定义（FsPort、NetworkPort、LoggingPort 等）与 use-case 编排

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
- TanStack Query
- Socket.IO Client
- AI SDK (@ai-sdk/react, @assistant-ui/react)

Shadcn UI 的 cli 对 monorepo 的支持不友好, 无法通过 cli 安装组件.
请手动安装组件, 并在 `apps/ui/src/components/ui/` 目录下创建对应的组件文件.

### apps/cli
命令行应用 (`smm`), 基于 Commander。`smm web` 命令启动 apps/server 提供的 HTTP 服务器。主要目录结构:
- `src/cli/` - CLI 命令定义与输出格式化
  - `commands/` - 各子命令实现 (list/add/show/recognize/plan/web 等)
- `src/web/` - `smm web` 启动编排 (startWeb)
- `src/utils/` - 入口专用工具 (authToken、清理器、TLS bypass)
- `test/` - CLI 级测试与测试助手

技术栈:
- Bun (运行时)
- Commander (命令行)
- `@smm/server` (HTTP 服务器库, 见 apps/server)

### apps/server
HTTP 服务器纯库 (无独立二进制), 由 apps/cli 的 `smm web` 引入。依赖方向: `apps/cli -> apps/server -> apps/core`, 本包禁止反向依赖 apps/cli。主要目录结构:
- `server.ts` - Server 类 (Hono + Socket.IO + 静态资源 + 反向代理)
- `src/route/` - HTTP API 路由
  - `ffmpeg/` - FFmpeg 相关 API (转换、截图)
  - `mediaMetadata/` - 媒体元数据 API
  - `ytdlp/` - yt-dlp 相关 API (下载、提取数据)
- `src/tools/` - 业务工具函数
- `src/mcp/` - MCP (Model Context Protocol) 服务器
  - `tools/` - MCP 工具定义
- `src/core/` - Core 单例组装 (getCore) 与平台 Port
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

### apps/convex

基于 Convex 的后台 API 服务

### apps/e2e
端到端测试, 主要目录结构:
- `test/specs/` - 测试用例
- `test/pageobjects/` - 页面对象
- `test/componentobjects/` - 组件对象
- `test/lib/` - 测试工具

技术栈:
- WebdriverIO 9
- Mocha

## 代码改动

**Post Change** run build and typecheck script after code change

**Pre Commit** run below commands before git commit, and fix the errors
```
pnpm knip
pnpm typecheck
pnpm build
pnpm test
```

## 发版

维护者发布 **Electron 桌面版** 与 **Docker 镜像** 的流程见 [docs/dev/release.md](./docs/dev/release.md)（共用 Git tag、单 GitHub Release 多产物、Docker 发版前 E2E gate 校验）。

### 核心术语

**媒体文件夹(Media Folder)** 保存了电视剧, 动画, 电影或音乐的本地文件夹
**媒体库(Media Library)** 保存了多个媒体文件夹的文件夹
**识别多媒体文件夹(Recognize Media Folder)**: 该操作用于指定文件夹保存的是哪一部电视剧或电影的视频文件
**识别季集视频文件(Recognize Episode Video File)**: 该操作用于指定电视剧每一集对应的本地视频文件
**元数据(Media Metadata)**: 元数据, 保存了文件夹对应的电视剧或电影的信息，以及本地视频文件和季集的对应关系
**视频文件和关联文件(Video File and Associated Files)** 视频文件通常还对应着字幕文件, 音频文件, 封面文件和 NFO 文件等, 这类文件被称为关联文件
**DVD** UI组件 Download Video Dialog, 其代码位于 `apps/ui/src/components/dialogs/UIDownloadVideoDialogContent.tsx`


## 技术架构

见 [架构总览](./docs/dev/overview.md)

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


## 代码架构

依赖方向: `apps/cli -> apps/server -> apps/core`, `apps/server` 禁止反向依赖 `apps/cli`（其内部别名使用 `@server/*`）.

### apps/ui

**apps/ui/src/hooks/userConfig/** 该目录提供了基于 TanStack Query 的读取和写入应用配置的方法, 如 `useConfig.ts`
**pps/ui/src/stores/uiMediaFolderStore.ts** 基于 Zustand 的全局状态类. 接口 `UIMediaFolder` 用于表示前端的多媒体目录. 该store是前端项目的核心状态, 被Sidebar, Statusbar, TvShowPanel, MoviePanle 和 MoviePanel 等主要组件依赖.
**apps/ui/src/hooks/mediaMetadata/** 基于 TanStack Query 的 MediaMetadata 读取和写入方法

### apps/cli

**index.ts** 入口分发: CLI 子命令（含 `web`）走 `src/cli/runCli.ts`（Commander）, 裸调用仅打印帮助.
**src/cli/commands/** 各子命令实现, 直接调用 `@smm/core`（经 `getCore({ logger: new CliLoggerAdapter(...) })` 注入 LoggingPort）.
**src/cli/cliLogger.ts** `CliLoggerAdapter`, CLI 侧 LoggingPort 实现, 留在 apps/cli.
**src/web/startWeb.ts** `smm web` 启动编排: 目录初始化、清理任务、auth、构造 `@smm/server` 的 `Server` 并注册优雅停机.
**src/utils/** 仅入口编排使用的平台工具: `authToken`、`CommandLogCleaner`、`YtdlpCookiesCleaner`、`tmdbTls`.

### apps/server

**server.ts** `Server` 类: Hono app + Socket.IO + 静态资源 + 路径挂载反向代理 + core-routes 分发.
**index.ts** 公共 API 导出（`Server`、`getCore`、`logger`、`utils/config` 路径函数等）, 供 apps/cli 消费.
**src/core/getCore.ts** Core 单例组装（平台 Port: `NodejsNetworkPort`、`BunMcpServerPort` 等）, CLI 与 `smm web` 同进程共享同一实例.
**src/route/** HTTP API 路由（thin shell, 共享逻辑委托 `@smm/core-routes`）.
**src/mcp/** MCP 服务器（`smm mcp start` 经 `Core.startMcpServer` 启动）.
**lib/logger.ts** pino 日志基础设施（含 `frontendLogger`）, 由 apps/cli 注入使用.

## apps/server API 列表
API列表可查阅文件: `docs/api/index.md`.


## 注意事项

1. 当代码改动涉及 `apps/ohos`时, 需要阅读 [HarmonyOS 开发 FAQ](docs/superpowers/reference/faq-harmonyos.md)

## Superpowers Skill
当使用 superpowers skillset 驱动改动时, 在 "writing-plans" 阶段, 需要为本项目额外编写/更新一份设计文档.

文档模板: [Design Template](./docs/superpowers/reference/design-template.md)

## References
[Testing in SMM](docs/dev/test.md)
