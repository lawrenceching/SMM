# Refatoring of 3-layers app

Current implementation mix business logic into UI layer, makes it very different to test and extend.

This refactoring aims to extract the core logic into below model:

```
Layer 1: Web UI, AI tools, MCP tools, external HTTP API
Layer 2: Core
Layer 3: internal HTTP API
```

Layer 1 is presentation layer which holds the UI, don't care of any business logic.
Using TanStack Query and socket.io to sync states

Layer 2 is headless business logic layer built in TypeScript.
Use adapter to support both browser runtime or node.js runtime(Electron or Node.js)

Layer 3 is infrastructure layer to support basic function like fs or logging.


## 目标架构

三层的依赖方向自上而下：**Layer 1 → Layer 2 → Layer 3**。上层依赖下层的接口，下层不感知上层的存在。

每一层只关心一件事：

| 层 | 名称 | 关心的问题 |
|----|------|-----------|
| Layer 1 | 表现层 (Presentation) | 如何与用户 / AI / 外部系统交互 |
| Layer 2 | 核心层 (Core) | 业务规则与流程是什么 |
| Layer 3 | 基础设施层 (Infrastructure) | 在具体宿主机上如何做到 fs / logging / 进程 / 网络 |

### Layer 1: 表现层 (Presentation)

**职责**：捕捉用户 / AI / 外部系统的意图，把它翻译成 Core 命令；渲染 Core 暴露的状态。不含任何业务编排、识别、重命名、文件扫描逻辑。

**内容清单**：
- **Web UI** (`apps/ui`)：组件、hooks、Zustand（仅保存纯 UI 状态，如选中项、对话框开关）、TanStack Query（服务端状态缓存）、API client
- **AI tools / MCP**：把 LLM 的工具调用翻译成 Core 命令，并渲染工具返回结果
- **External HTTP API**：面向应用外部的公开契约，委托给 Core
- **Socket.IO 客户端**：订阅 Core 推送的状态变化

**状态同步**（Layer 1 获取状态的两个手段，二者配合）：
- **拉取 (pull)**：TanStack Query 定时轮询状态查询接口（如每 1s 轮询一次初始化状态）
- **推送 (push)**：Socket.IO 事件使对应 query key 失效 / 直接写入缓存，立即触发重渲染

### Layer 2: 核心层 (Core)

**职责**：全部业务逻辑，以 headless TypeScript 实现，与运行时和框架完全解耦。

**内容清单**：
- **领域模型**：MediaFolder、MediaMetadata、Episode、RenameOperation、Plan、Job 等
- **用例 (use-cases) / 编排**：初始化媒体文件夹、识别媒体文件夹、识别剧集、重命名计划、下载 / 转码任务编排
- **纯逻辑**：识别流水线 (recognition pipeline)、重命名规则 (rename rules)、NFO 解析、剧集匹配算法
- **Ports（端口）定义**：`fs`、`logger`、`subprocess`、`env`、`network`、`clock`、`db` —— 只声明接口，不实现
- **Domain events**：业务状态变化以事件形式广播，供表现层订阅

**约束**：
- 不 import 任何平台 API（`node:fs`、`process`、`window`、`navigator`…），只能通过注入的适配器访问能力
- 框架无关：不依赖 Hono / Express / React / Zod 之外的运行时框架
- 可单测：给定输入 + mock 适配器，断言用例输出与副作用调用
- 可运行在任何宿主：Node.js / Bun 后端、Electron 主进程、浏览器 Web Worker

### Layer 3: 基础设施层 (Infrastructure)

**职责**：在具体宿主机上实现 Core 声明的 Ports，并承载统一的应用内部 HTTP 服务。

**内容清单**：
- **Ports 的具体实现**：文件系统访问、pino 日志、yt-dlp / ffmpeg 子进程、TMDB / TVDB 网络请求、数据库
- **Internal HTTP API**：应用内部命令入口与状态查询的统一 HTTP 服务（即当前 `packages/core-routes` 与 `apps/cli` 的路由）
- **Socket.IO 服务端**：向表现层推送状态
- **宿主进程**：`apps/cli`（独立后端）、`apps/electron`（主进程内嵌）、`apps/ohos`

**Internal vs External HTTP API 的区别**：
- **External HTTP API**（Layer 1 表现面之一）面向应用之外，是公开契约
- **Internal HTTP API**（Layer 3）面向应用之内，是 UI、MCP、外部 API 触发 Core 与访问基础设施的统一通道。两者可能共享同一物理服务器，区别在于用途与暴露范围

## 通信模型

### 命令流（command）

```
Web UI / AI(MCP) / External API
        │  HTTP POST /api/...
        ▼
Internal HTTP API (Layer 3)
        │  委托用例
        ▼
Core use-case (Layer 2)
        │  通过注入的适配器
        ▼
Infrastructure: fs / logging / subprocess / network / db
```

### 状态流（state）

```
Core 用例变更状态
        │ 持久化 + 广播 domain event
        ▼
Internal HTTP API 持久化到磁盘 / db
        │
        ├─ Socket.IO push（立即失效 query 缓存）
        └─ GET 状态接口（供 TanStack Query 轮询兜底）
        ▼
Web UI 重渲染
```

## 示例: 媒体文件夹初始化

媒体文件夹初始化是当前实现最典型的反面教材。

`apps\ui\src\hooks\initialization\useInitializeImportedMediaFolder.ts` 把整套初始化流程（更新用户配置、识别媒体文件夹、识别剧集、保存元数据、任务状态管理）全部实现于 UI 侧，使得该流程几乎不可能被外部 HTTP API 或 MCP 用户触发，也难以单元测试。

**Current Implementation**
1. User import folder
2. UI update user config file
3. UI start initialization process
4. UI update UI states accordingly

**Target Implementation**
1. User import folder
2. UI call "POST /api/importFolder"
3. Core (sitting in backend side) update user config file
4. Core start initialization process
5. UI sycn initialization state by TanStack Query (fetch state every 1s)

**Target 详细时序**

```
UI                         Internal HTTP API            Core                          Infrastructure
 │  POST /api/importFolder        │                        │                                 │
 ├───────────────────────────────►│                        │                                 │
 │                                │  importFolder(folder)  │                                 │
 │                                ├────────────────────────►│                                 │
 │                                │                        │  fs.write(userConfig)           │
 │                                │                        ├────────────────────────────────►│
 │                                │                        │  识别流水线 (tvshow/movie/music)  │
 │                                │                        ├────────────────────────────────►│ (TMDB/TVDB/NFO/ffprobe)
 │                                │                        │  metadata 持久化 + 广播事件      │
 │                                │                        ├────────────────────────────────►│
 │                                │  socket.io: folder.status=initializing/ok  ◄───────────┤
 │  ◄─────────────────────────────┤                        │                                 │
 │  GET /api/mediaFolder/:path/status (每 1s 轮询兜底)       │                                 │
 │  ├─────────────────────────────►│                        │                                 │
 │  ◄─────────────────────────────┤                        │                                 │
 │  TanStack Query 更新 → 重渲染    │                        │                                 │
```

**现状代码位置 vs 目标代码位置**

| 逻辑 | 现状 | 目标 |
|------|------|------|
| 初始化编排 | `apps/ui/src/hooks/initialization/useInitializeImportedMediaFolder.ts` | Layer 2 (Core use-case) |
| 识别流水线 | `apps/ui/src/lib/mediaFolderRecognitionPipeline.ts` | Layer 2 |
| 识别媒体文件夹 | `apps/ui/src/lib/recognizeMediaFolder.ts`、`recognizeMediaFolderByTmdbIdInFolderName.ts`、`recognizeMediaFolderByTvdbIdInFolderName.ts`、`tryToRecognizeMediaFolderBySearchingFolderNameInTMDB.ts`、`tryToRecognizeMediaFolderBySearchingFolderNameInTVDB.ts` | Layer 2 |
| 识别剧集 | `apps/ui/src/lib/recognizeEpisodes.ts` | Layer 2 |
| NFO 解析 | `apps/ui/src/lib/nfo.ts` | Layer 2 |
| 重命名规则 | `apps/ui/src/lib/renameRules.ts` | Layer 2 |
| 任务工厂 | `apps/ui/src/lib/*JobFactory.ts` | Layer 2 |
| 音乐目录初始化 | `apps/ui/src/lib/initializeMusicFolder.ts`、`music.ts` | Layer 2 |
| 状态同步 | UI Zustand + TanStack Query | 不变（表现层职责） |
| fs / 子进程 / 日志 | `apps/cli` + `packages/core-routes` | Layer 3（host 适配器） |

## 与现有 monorepo 的映射

| 现有包 / 应用 | 目标层 | 演进方向 |
|---------------|--------|----------|
| `packages/core` | Layer 2 | 扩展为 headless 业务逻辑层：引入 Ports 定义，新增 use-cases 与编排，沉淀领域模型 |
| `packages/core-routes` | Layer 3 | 已是框架无关的通用 HTTP 路由（含 auth / allowlist / socket.io），作为 Internal HTTP API 的核心 |
| `apps/cli` | Layer 3 宿主 | 独立后端：提供基础设施实现（fs / yt-dlp / ffmpeg / pino）+ MCP 服务 + Socket.IO |
| `apps/electron` | Layer 3 宿主 | 主进程内嵌 Core + Core-routes，提供 Node.js 适配器 |
| `apps/ohos` | Layer 3 宿主 | 提供 HarmonyOS 适配器 |
| `apps/ui` | Layer 1 | 只保留表现层：组件、hooks、Zustand（纯 UI 状态）、TanStack Query、API client |
| MCP（`apps/cli/src/mcp`、`packages/core-routes/src/mcp`） | Layer 1 表现面 | 将 LLM 工具调用翻译成 Core 命令，不再内联业务逻辑 |

## 迁移路径

分四阶段，每阶段保持可构建、可测试。

**Phase 1: 提取纯逻辑**
- 将 `apps/ui/src/lib` 中无 React 依赖的纯逻辑（nfo、renameRules、recognizeEpisodes、识别流水线等）移入 `packages/core`
- 在 core 中定义 Ports 接口（fs / logger / subprocess / network / db）
- 为纯逻辑补齐单元测试（core 已有 vitest）

**Phase 2: 编排用例下沉**
- 初始化 / 识别 / 重命名 / 任务编排作为 use-cases 移入 core，依赖注入适配器
- UI hooks 改为调用 HTTP API + TanStack Query，删除本地编排代码

**Phase 3: Internal HTTP API 补齐**
- 新增 `POST /api/importFolder` 等命令路由，将 HTTP 请求映射到 Core 用例
- 状态通过 Socket.IO 推送 + 轮询查询接口暴露

**Phase 4: 宿主适配器收敛**
- 各宿主（cli / electron / ohos）只保留基础设施实现与启动代码
- UI 不再包含任何业务逻辑，只剩表现层

## 测试策略

| 层 | 测试方式 | 说明 |
|----|----------|------|
| Layer 2 (core) | 单元测试 (vitest) | mock 适配器，断言用例输出与副作用调用 |
| Layer 3 | 路由级集成测试 | 现有 `*.test.ts` 风格，验证 HTTP 契约与 auth / allowlist |
| Layer 1 | 组件测试 + e2e | `apps/e2e` (WebdriverIO) 保持不变，验证端到端行为 |
