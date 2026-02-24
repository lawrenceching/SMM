# apps/ui 代码架构文档

## 概述

`apps/ui` 是一个基于 React 19 + TypeScript + Vite 构建的前端应用，用于媒体文件管理和元数据编辑。采用 Provider 模式进行状态管理，使用 Socket.IO 进行实时通信。

## 目录结构

```
apps/ui/src/
├── main.tsx                    # 应用入口
├── App.tsx                     # 原始三栏布局应用
├── AppV2.tsx                   # 增强版应用（默认使用）
├── AppInitializer.tsx          # 应用初始化
├── AppNavigation.tsx           # 移动端导航
├── ai/                         # AI 助手相关
│   ├── Assistant.tsx           # AI 助手组件
│   ├── prompts.ts              # AI 系统提示词
│   └── tools/                  # AI 工具定义
├── api/                        # API 客户端
│   ├── index.ts                # API 导出
│   ├── readMediaMetadata*.ts   # 读取媒体元数据
│   ├── writeMediaMetadata.ts   # 写入媒体元数据
│   ├── tmdb.ts                 # TMDB API
│   └── ...                     # 其他 API
├── components/                 # React 组件
│   ├── ui/                     # 基础 UI 组件 (shadcn/ui)
│   ├── dialogs/                # 对话框组件
│   ├── eventlisteners/         # WebSocket 事件监听器
│   ├── background-jobs/        # 后台任务管理
│   ├── sidebar/                # 侧边栏组件
│   ├── v2/                     # AppV2 专用组件
│   ├── hooks/                  # 组件专用 hooks
│   ├── TvShowPanel.tsx         # 电视剧面板
│   ├── MoviePanel.tsx          # 电影面板
│   ├── MusicPanel.tsx          # 音乐面板
│   └── ...                     # 其他组件
├── hooks/                      # 全局 hooks
│   └── useWebSocket.ts         # WebSocket 连接管理
├── lib/                        # 工具库
│   ├── utils.ts                # 通用工具函数
│   ├── path.ts                 # 路径处理
│   ├── i18n.ts                 # 国际化
│   └── ...                     # 其他工具
├── providers/                  # Context Providers
│   ├── config-provider.tsx     # 配置管理
│   ├── media-metadata-provider.tsx  # 媒体元数据管理
│   ├── dialog-provider.tsx     # 对话框管理
│   ├── global-states-provider.tsx   # 全局状态管理
│   └── theme-provider.tsx      # 主题管理
└── types/                      # TypeScript 类型定义
    ├── UIMediaMetadata.ts      # UI 媒体元数据类型
    ├── eventTypes.ts           # 事件类型
    └── ...                     # 其他类型
```

## 应用启动流程

### 1. 入口点 (main.tsx)

```
createRoot()
  └── <ThemeProvider>
        └── <ConfigProvider>
              └── <MediaMetadataProvider>
                    └── <GlobalStatesProvider>
                          └── <DialogProvider>
                                └── <BackgroundJobsProvider>
                                      ├── <AppInitializer />
                                      └── <AppSwitcher />
```

**关键代码位置**: `main.tsx:242-259`

### 2. 应用初始化 (AppInitializer.tsx)

```
AppInitializer.mount()
  └── ConfigProvider.reload()
        └── hello() API
        └── readUserConfig()
        └── onSuccess:
              └── buildMediaMetadata()
                    └── 遍历 userConfig.folders
                          └── loadUIMediaMetadata()
                                ├── readMediaMetadataApi()
                                └── listFiles()
              └── setSelectedMediaMetadata(localStorage.selectedFolderIndex)
```

**关键代码位置**: `AppInitializer.tsx:50-76`

### 3. 应用切换器 (main.tsx - AppSwitcher)

```
AppSwitcher()
  ├── useWebSocket()           // 建立 WebSocket 连接
  ├── isMobile ?
  │     └── <AppNavigation />  // 移动端
  │     └── <WebSocketHandlers />
  │     └── <EventListeners />
  └── <AppV2 /> | <App />      // 桌面端
        └── <WebSocketHandlers />
        └── <EventListeners />
```

**关键代码位置**: `main.tsx:183-240`

## Provider 架构

### Provider 层级和职责

| Provider | 文件 | 职责 |
|----------|------|------|
| `ThemeProvider` | `theme-provider.tsx` | 明暗主题管理 |
| `ConfigProvider` | `config-provider.tsx` | 应用配置和用户配置管理 |
| `MediaMetadataProvider` | `media-metadata-provider.tsx` | 媒体元数据 CRUD 操作 |
| `GlobalStatesProvider` | `global-states-provider.tsx` | 待处理计划（识别/重命名）管理 |
| `DialogProvider` | `dialog-provider.tsx` | 全局对话框状态管理 |
| `BackgroundJobsProvider` | `BackgroundJobsProvider.tsx` | 后台任务进度管理 |

### ConfigProvider 调用链

```
useConfig()
  └── 返回 Context 值:
        ├── appConfig: { version, userDataDir }
        ├── userConfig: UserConfig
        ├── reload(callback?)
        │     ├── hello() API
        │     ├── readUserConfig()
        │     └── changeLanguage()
        ├── setAndSaveUserConfig(traceId, config)
        │     ├── changeLanguage()
        │     └── writeFile(smm.json)
        └── addMediaFolderInUserConfig(traceId, folder)
              └── writeFile(smm.json)
```

**关键代码位置**: `config-provider.tsx:34-193`

### MediaMetadataProvider 调用链

```
useMediaMetadata()
  └── 返回 Context 值:
        ├── mediaMetadatas: UIMediaMetadata[]
        ├── selectedMediaMetadata: UIMediaMetadata | undefined
        ├── addMediaMetadata(metadata, { traceId })
        │     ├── writeMediaMetadata() API
        │     └── _addOrUpdateMediaMetadata()
        ├── updateMediaMetadata(path, metadata, { traceId })
        │     ├── hasMediaMetadataChanged()
        │     ├── writeMediaMetadata() API (如有变更)
        │     └── _addOrUpdateMediaMetadata()
        ├── removeMediaMetadata(path)
        │     ├── deleteMediaMetadata() API
        │     └── setMediaMetadatas(filter)
        ├── refreshMediaMetadata(path)
        │     └── readMediaMetadataV2() API
        └── reloadMediaMetadatas()
              └── 遍历 folders -> readMediaMetadataV2()
```

**关键代码位置**: `media-metadata-provider.tsx:99-319`

### DialogProvider 调用链

```
useDialogs()
  └── 返回 Context 值:
        ├── confirmationDialog: [openConfirmation, closeConfirmation]
        ├── spinnerDialog: [openSpinner, closeSpinner]
        ├── configDialog: [openConfig, closeConfig]
        ├── openFolderDialog: [openOpenFolder, closeOpenFolder]
        ├── filePickerDialog: [openFilePicker, closeFilePicker]
        ├── downloadVideoDialog: [openDownloadVideo, closeDownloadVideo]
        ├── mediaSearchDialog: [openMediaSearch, closeMediaSearch]
        ├── renameDialog: [openRename, closeRename]
        ├── scrapeDialog: [openScrape, closeScrape]
        ├── filePropertyDialog: [openFileProperty, closeFileProperty]
        └── formatConverterDialog: [openFormatConverter, closeFormatConverter]
```

**关键代码位置**: `dialog-provider.tsx:80-410`

## WebSocket 通信

### 连接管理 (useWebSocket.ts)

```
useWebSocket()
  └── connect()
        ├── io(socketUrl, options)
        ├── socket.on('connect')
        ├── socket.on('hello') -> socket.emit('userAgent')
        ├── socket.onAny() -> 分发到 webSocketEventListeners
        ├── socket.on('disconnect')
        └── socket.on('connect_error')

useWebSocketEvent(handler)
  └── 注册到 webSocketEventListeners Set

sendAcknowledgement(message, response)
  └── message._socketCallback(response)
```

**关键代码位置**: `useWebSocket.ts:120-284`

### 事件监听器组件

| 组件 | 文件 | 监听事件 |
|------|------|----------|
| `SocketIoUserConfigFolderRenamedEventListener` | `eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx` | 文件夹重命名 |
| `PingEventListener` | `eventlisteners/PingEventListener.tsx` | 心跳检测 |
| `RenameFilesPlanReadyEventListener` | `eventlisteners/RenameFilesPlanReadyEventListener.tsx` | 重命名计划就绪 |
| `UserConfigUpdatedEventListener` | `eventlisteners/UserConfigUpdatedEventListener.tsx` | 用户配置更新 |
| `MediaMetadataUpdatedEventListener` | `eventlisteners/MediaMetadataUpdatedEventListener.tsx` | 媒体元数据更新 |
| `MediaFolderImportedEventHandler` | `eventlisteners/MediaFolderImportedEventHandler.tsx` | 媒体文件夹导入 |
| `FixedDelayBackgroundJobHandler` | `eventlisteners/FixedDelayBackgroundJobHandler.tsx` | 后台任务处理 |

### 媒体文件夹导入流程

```
用户点击"打开文件夹"
  └── handleOpenFolderMenuClick() [AppV2.tsx:233]
        ├── isElectron() ?
        │     └── openNativeFileDialog()
        │           └── electron.dialog.showOpenDialog()
        └── openFilePicker() [DialogProvider]
              └── openOpenFolder() [选择类型]
                    └── document.dispatchEvent(UI_MediaFolderImportedEvent)

MediaFolderImportedEventHandler 接收事件
  └── eventListener.current() [MediaFolderImportedEventHandler.tsx:25]
        ├── addMediaFolderInUserConfig()
        ├── backgroundJobs.addJob()
        ├── createInitialMediaMetadata()
        ├── readMediaMetadataApi()
        ├── isMetadataIncomplete ?
        │     ├── addMediaMetadata(mm)
        │     ├── updateMediaMetadata({ status: 'initializing' })
        │     └── doPreprocessMediaFolder()
        │           └── onSuccess: updateMediaMetadata({ status: 'ok' })
        └── setJobStatus('succeeded')
```

**关键代码位置**: `MediaFolderImportedEventHandler.tsx:16-230`

## 主要组件

### AppV2 布局

```
AppV2Content()
  └── Grid Layout:
        ├── toolbar: <Toolbar />
        │     ├── onOpenFolderMenuClick
        │     ├── onOpenMediaLibraryMenuClick
        │     ├── viewMode: "metadata" | "files"
        │     └── onViewModeChange
        ├── sidebar: <Sidebar /> (可调整宽度)
        │     ├── <MediaFolderToolbar /> (排序/筛选)
        │     ├── <SearchForm />
        │     └── <MediaFolderListItem />[]
        ├── content:
        │     ├── folders.length === 0 ? <Welcome />
        │     └── selectedMediaMetadata ?
        │           ├── viewMode === "metadata":
        │           │     ├── tvshow-folder -> <TvShowPanel />
        │           │     ├── movie-folder -> <MoviePanel />
        │           │     ├── music-folder -> <MusicPanel />
        │           │     └── other -> <LocalFilePanel />
        │           └── viewMode === "files":
        │                 └── <LocalFilePanel />
        └── statusbar: <StatusBar />
```

**关键代码位置**: `AppV2.tsx:29-714`

### TvShowPanel 组件

```
TvShowPanel()
  └── <TvShowPanelPromptsProvider>
        └── TvShowPanelContent()
              ├── useTvShowPanelState() -> seasons, selectedNamingRule
              ├── useTvShowFileNameGeneration() -> 文件名生成
              ├── useTvShowRenaming() -> 重命名逻辑
              ├── useTvShowWebSocketEvents() -> WebSocket 事件
              ├── useEffect: 检查 TMDB ID 从文件夹名
              │     └── getTmdbIdFromFolderName()
              │           └── getTvShowById()
              │                 └── openUseTmdbIdFromFolderNamePrompt()
              ├── useEffect: 处理 pendingPlans
              │     └── plan.tmp ?
              │           └── openRuleBasedRecognizePrompt()
              │           └── openAiRecognizePrompt()
              ├── useEffect: 处理 pendingRenamePlans
              │     └── openAiBasedRenameFilePrompt()
              └── <TMDBTVShowOverview>
                    ├── 剧集信息展示
                    ├── onRenameClick -> openRuleBasedRenameFilePrompt()
                    ├── onRecognizeButtonClick -> handleRuleBasedRecognizeButtonClick()
                    └── seasons (预览模式 ? seasonsForPreview : seasons)
```

**关键代码位置**: `TvShowPanel.tsx:48-717`

### Sidebar 组件

```
Sidebar(props)
  ├── <Menu onOpenFolderMenuClick={handleOpenFolderMenuClick} />
  ├── <MediaFolderToolbar />
  │     ├── sortOrder: alphabetical | reverse-alphabetical
  │     └── filterType: all | tvshow | movie | music
  ├── <SearchForm />
  └── <MediaFolderListItem />[]
        └── onClick -> handleMediaFolderListItemClick()
```

**关键代码位置**: `sidebar/Sidebar.tsx:118-152`

## API 调用

### API 模块结构

```
api/
├── index.ts              # 导出 readMediaMetadata
├── hello.ts              # GET /api/hello
├── readMediaMatadata.ts  # POST /api/read-media-metadata
├── readMediaMetadataV2.ts # POST /api/read-media-metadata-v2
├── writeMediaMetadata.ts # POST /api/write-media-metadata
├── deleteMediaMetadata.ts # DELETE /api/media-metadata
├── listFiles.ts          # POST /api/list-files
├── renameFile.ts         # POST /api/rename-file
├── renameFiles.ts        # POST /api/rename-files
├── tmdb.ts               # TMDB API 代理
├── getPendingPlans.ts    # GET /api/pending-plans
├── updatePlan.ts         # PUT /api/plan/:id/status
└── ...
```

### 主要 API 调用链

#### 读取媒体元数据

```
readMediaMetadataApi(folderPath)
  └── fetch('POST', '/api/read-media-metadata', { folderPath })
        └── 响应: { data: MediaMetadata | null }
```

**关键代码位置**: `api/readMediaMatadata.ts`

#### 写入媒体元数据

```
writeMediaMetadata(metadata, { traceId })
  └── fetch('POST', '/api/write-media-metadata', { metadata, traceId })
        └── 响应: { success: boolean }
```

**关键代码位置**: `api/writeMediaMetadata.ts`

#### TMDB 搜索

```
getTvShowById(tmdbId, language)
  └── fetch('GET', `/api/tmdb/tv/${tmdbId}?language=${language}`)
        └── 响应: { data: TMDBTVShow, error?: string }
```

**关键代码位置**: `api/tmdb.ts`

## AI 助手

### Assistant 组件

```
Assistant()
  └── useChatRuntime({
        transport: AssistantChatTransport({
          api: "/api/chat",
          body: { clientId: getOrCreateClientId() }
        }),
        onFinish: (options) => { ... }
      })
  └── <AssistantRuntimeProvider runtime={runtime}>
        ├── <ModelContext />
        │     └── api.modelContext().register({
        │           getModelContext: () => ({ system: prompts.system })
        │         })
        └── <AssistantModal />
```

**关键代码位置**: `ai/Assistant.tsx:29-63`

## 后台任务管理

### BackgroundJobsProvider

```
useBackgroundJobs()
  └── 返回 Context 值:
        ├── jobs: BackgroundJob[]
        ├── addJob(name): jobId
        │     ├── 创建 { id, name, status: 'pending', progress: 0 }
        │     ├── setJobs([...prev, newJob])
        │     └── setPopoverOpen(true)
        ├── updateJob(id, updates)
        │     └── setJobs(map(job => job.id === id ? {...job, ...updates} : job))
        ├── abortJob(id)
        │     └── updateJob(id, { status: 'aborted' })
        ├── getRunningJobs()
        ├── isPopoverOpen
        └── setPopoverOpen
```

**关键代码位置**: `BackgroundJobsProvider.tsx:20-85`

## 事件驱动架构

### 自定义事件类型

```typescript
// types/eventTypes.ts
export const UI_MediaFolderImportedEvent = 'ui:media-folder-imported'

export interface OnMediaFolderImportedEventData {
  type: 'tvshow' | 'movie' | 'music'
  folderPathInPlatformFormat: string
  traceId: string
}
```

### 事件分发模式

```
组件 A:
  document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))

EventHandler 组件:
  useMount(() => {
    document.addEventListener(UI_MediaFolderImportedEvent, handler)
  })
  useUnmount(() => {
    document.removeEventListener(UI_MediaFolderImportedEvent, handler)
  })
```

## 数据流图

### 媒体文件夹打开流程

```
[用户操作]
    │
    ▼
[Toolbar] handleOpenFolderMenuClick()
    │
    ├── Electron 环境
    │   └── openNativeFileDialog() → electron.dialog.showOpenDialog()
    │
    └── 浏览器环境
        └── openFilePicker() → FilePickerDialog
    │
    ▼
[OpenFolderDialog] 选择类型 (tvshow/movie/music)
    │
    ▼
document.dispatchEvent(UI_MediaFolderImportedEvent)
    │
    ▼
[MediaFolderImportedEventHandler]
    │
    ├── addMediaFolderInUserConfig() → 写入 smm.json
    │
    ├── backgroundJobs.addJob() → 创建后台任务
    │
    ├── createInitialMediaMetadata() → 创建初始元数据
    │
    ├── readMediaMetadataApi() → 读取现有元数据
    │
    ├── 元数据不完整?
    │   ├── addMediaMetadata() → 写入元数据文件
    │   ├── updateMediaMetadata({ status: 'initializing' })
    │   └── doPreprocessMediaFolder() → AI/规则识别
    │       └── onSuccess: updateMediaMetadata({ status: 'ok' })
    │
    └── backgroundJobs.updateJob({ status: 'succeeded' })
    │
    ▼
[MediaMetadataProvider] 状态更新
    │
    ▼
[Sidebar] 显示新文件夹
    │
    ▼
[TvShowPanel/MoviePanel/MusicPanel] 显示内容
```

### 剧集识别流程

```
[TvShowPanel] mediaMetadata 变化
    │
    ├── tmdbTvShow 未设置?
    │   └── getTmdbIdFromFolderName() → 从文件夹名提取 TMDB ID
    │       └── getTvShowById() → 查询 TMDB
    │           └── openUseTmdbIdFromFolderNamePrompt() → 确认使用
    │               └── handleSelectResult() → 更新元数据
    │
    ├── pendingPlans 有匹配计划?
    │   ├── plan.tmp? (规则识别)
    │   │   └── openRuleBasedRecognizePrompt()
    │   │       └── recognizeEpisodes() → 应用识别结果
    │   │
    │   └── AI 识别
    │       └── openAiRecognizePrompt()
    │           └── handleAiRecognizeConfirm() → applyRecognizeMediaFilePlan()
    │
    └── buildSeasonsModelFromMediaMetadata() → 构建 seasons
        │
        ▼
[TMDBTVShowOverview] 渲染季度/剧集
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 |
| 构建 | Vite |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| UI 组件 | shadcn/ui + Radix UI |
| 状态管理 | React Context (Provider 模式) |
| 实时通信 | Socket.IO Client |
| 国际化 | i18next |
| AI 助手 | @assistant-ui/react + AI SDK |
| 测试 | Vitest |
| 代码规范 | ESLint |

## 配置文件

| 文件 | 用途 |
|------|------|
| `vite.config.ts` | Vite 构建配置，代理设置 |
| `package.json` | 依赖和脚本 |
| `tsconfig.json` | TypeScript 配置 |
| `eslint.config.js` | ESLint 规则 |
| `vitest.config.ts` | 测试配置 |

## 关键路径别名

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@core': path.resolve(__dirname, '../../packages/core/src'),
  }
}
```
