# apps/ui 代码重构与改进计划

## 审核概要

**审核日期**: 2026-02-25
**代码版本**: 1.1.2
**技术栈**: React 19 + TypeScript + Vite + Tailwind CSS

**总体评估**: ⭐⭐⭐☆☆ (3/5)

代码功能完整，架构基本合理，但存在以下主要问题：
- 状态管理分散，缺乏统一的数据流
- 组件职责不清晰，部分组件过于庞大
- 缺少错误边界和统一的错误处理
- 测试覆盖率不足
- 存在性能隐患

---

## 一、架构层面问题

### 1.1 Provider 层级过深且职责交叉 (已拒绝)

**问题描述**:
Provider 嵌套层级达 6 层，部分 Provider 职责重叠。

```tsx
// main.tsx:242-259 - 当前结构
<ThemeProvider>
  <ConfigProvider>
    <MediaMetadataProvider>
      <GlobalStatesProvider>
        <DialogProvider>
          <BackgroundJobsProvider>
            {/* ... */}
          </BackgroundJobsProvider>
        </DialogProvider>
      </GlobalStatesProvider>
    </MediaMetadataProvider>
  </ConfigProvider>
</ThemeProvider>
```

**问题点**:
- `GlobalStatesProvider` 中的 `pendingPlans` 与 `MediaMetadataProvider` 中的 `mediaMetadatas` 存在关联但分散管理
- `DialogProvider` 管理 11 种对话框状态，过于臃肿

**建议**:
```tsx
// 重构后结构
<AppProvider>  {/* 统一入口 */}
  <FeatureProviders>  {/* 功能相关 Provider 组合 */}
    <UIProviders>  {/* UI 相关 Provider */}
      {/* ... */}
    </UIProviders>
  </FeatureProviders>
</AppProvider>
```

### 1.2 双版本应用共存 (App.tsx / AppV2.tsx) (已完成)

**问题描述**:
存在两套应用入口，代码重复且维护成本高。

**当前状态**:
- `App.tsx` (540 行) - 原始三栏布局
- `AppV2.tsx` (716 行) - 增强版

**建议**:
1. **短期**: 在 `AppV2` 稳定后废弃 `App`
2. **长期**: 使用 Feature Flag 控制功能开关，而非维护两套代码

### 1.3 事件驱动架构混乱 (已拒绝)

**问题描述**:
混合使用多种事件机制：
- Socket.IO 事件 (`useWebSocketEvent`)
- DOM 自定义事件 (`document.dispatchEvent`)
- Context 状态更新

**示例** (`MediaFolderImportedEventHandler.tsx:25`):
```tsx
document.addEventListener(UI_MediaFolderImportedEvent, eventListener.current);
```

**建议**:
统一使用 Zustand 或 Jotai 等状态管理库，移除 DOM 事件通信。

---

## 二、组件层面问题

### 2.1 巨型组件

| 组件 | 文件 | 行数 | 问题 |
|------|------|------|------|
| `TvShowPanel` | `TvShowPanel.tsx` | 718 | 职责过多：识别、重命名、WebSocket、UI |
| `TMDBTVShowOverview` | `tmdb-tvshow-overview.tsx` | 511 | 混合数据获取、状态管理和渲染 |
| `TvShowPanelUtils` | `TvShowPanelUtils.ts` | 1176 | 工具文件包含业务逻辑 |
| `AppV2` | `AppV2.tsx` | 716 | 包含过多业务逻辑和内联样式 |
| `DialogProvider` | `dialog-provider.tsx` | 411 | 管理 11 种对话框状态 |

### 2.2 TvShowPanel 重构建议

**当前结构**:
```
TvShowPanel (718 行)
├── 状态管理 (多个 useState)
├── WebSocket 事件处理
├── AI 识别逻辑
├── 规则识别逻辑
├── 重命名逻辑
├── 文件选择逻辑
└── 渲染逻辑
```

**重构后结构**:
```
TvShowPanel/
├── index.tsx                    # 入口组件 (100 行以内)
├── TvShowPanelContent.tsx       # 主内容组件
├── hooks/
│   ├── useTvShowPanelState.ts   # 状态管理 ✓ (已存在)
│   ├── useTvShowWebSocketEvents.ts ✓
│   ├── useTvShowFileNameGeneration.ts ✓
│   ├── useTvShowRenaming.ts ✓
│   └── useTvShowRecognition.ts  # 新增：识别逻辑
├── components/
│   ├── TvShowHeader.tsx
│   ├── TvShowActions.tsx
│   └── TvShowSeasons.tsx
└── utils/
    └── tvShowHelpers.ts         # 纯工具函数
```

### 2.3 组件职责不单一

**示例** (`tmdb-tvshow-overview.tsx:58-509`):
```tsx
// 混合了多种职责：
// 1. 搜索功能 (handleSearch)
// 2. 数据获取 (getTvShowById)
// 3. 状态管理 (多个 useState)
// 4. 剧集展开逻辑
// 5. 滚动定位逻辑
// 6. UI 渲染
```

**建议拆分**:
- `useTmdbSearch` hook - 搜索逻辑
- `useSeasonExpansion` hook - 展开/折叠逻辑
- `TMDBTVShowHeader` - 头部信息
- `TMDBTVShowActions` - 操作按钮
- `TMDBTVShowSeasonList` - 季度列表

---

## 三、状态管理问题

### 3.1 状态分散

**问题描述**:
相同类型的状态分散在多个 Provider 中：

| 状态 | 位置 | 问题 |
|------|------|------|
| 媒体元数据 | `MediaMetadataProvider` | - |
| 待处理计划 | `GlobalStatesProvider` | 与元数据关联但分离 |
| 对话框状态 | `DialogProvider` | 11 种对话框状态 |
| 后台任务 | `BackgroundJobsProvider` | - |

**建议**:
采用 Zustand 统一管理，按领域划分 store：
```typescript
// stores/mediaStore.ts
export const useMediaStore = create<MediaStore>((set, get) => ({
  // 媒体元数据
  metadatas: [],
  selectedMetadata: null,

  // 识别计划
  pendingPlans: [],
  pendingRenamePlans: [],

  // Actions
  addMetadata: (metadata) => { /* ... */ },
  updatePlan: (planId, status) => { /* ... */ },
}));
```

### 3.2 Props Drilling

**问题描述**:
`AppV2.tsx` 中存在大量 props 传递：

```tsx
// AppV2.tsx:587-600
<Sidebar
  sortOrder={sortOrder}
  onSortOrderChange={setSortOrder}
  filterType={filterType}
  onFilterTypeChange={setFilterType}
  searchQuery={searchQuery}
  onSearchQueryChange={setSearchQuery}
  filteredAndSortedFolders={filteredAndSortedFolders}
  selectedFolderPaths={selectedFolderPaths}
  primaryFolderPath={primaryFolderPath}
  onFolderClick={onFolderClick}
  onSelectAll={onSelectAll}
  onDeleteSelected={onDeleteSelected}
/>
```

**建议**:
使用 Context 或 Zustand 减少 props drilling。

### 3.3 状态同步问题

**问题描述**:
`MediaMetadataProvider` 中的状态与服务器状态可能不同步：

```tsx
// media-metadata-provider.tsx:254-276
const reloadMediaMetadatas = useCallback(async ({ traceId }) => {
  // 多个异步操作，无并发控制
  const promises = userConfig.folders.map((path) => {
    readMediaMetadataV2(folderPathInPosix, { traceId })
      .then((mediaMetadataInResponse) => {
        _addOrUpdateMediaMetadata({ ... });
      })
  });
  await Promise.all(promises);
}, [userConfig, updateMediaMetadata]);
```

**建议**:
引入 React Query 或 SWR 管理服务器状态：
```typescript
// hooks/useMediaMetadataQuery.ts
export function useMediaMetadata(folderPath: string) {
  return useQuery({
    queryKey: ['mediaMetadata', folderPath],
    queryFn: () => readMediaMetadataV2(folderPath),
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## 四、性能问题

### 4.1 不必要的重渲染

**问题 1**: `useMemo` / `useCallback` 使用不一致

```tsx
// AppV2.tsx - 部分使用了 useMemo
const filteredAndSortedFolders = useMemo(() => { /* ... */ }, [folders, sortOrder, filterType, searchQuery]);

// 但其他地方缺少优化
const folders: MediaFolderListItemProps[] = useMemo(() => { /* ... */ }, [mediaMetadatas]);
// 后续使用 folders.length 进行条件渲染，每次 mediaMetadatas 变化都会触发
```

**问题 2**: `TvShowPanelUtils.ts` 中的函数未记忆化

```tsx
// TvShowPanel.tsx:15
import { recognizeEpisodes, updateMediaFileMetadatas, buildSeasonsByRecognizeMediaFilePlan, ... } from "./TvShowPanelUtils"
// 这些函数在每次渲染时都会被重新创建引用
```

### 4.2 列表渲染优化

**问题描述**:
`Sidebar` 中的文件夹列表缺少虚拟化：

```tsx
// v2/Sidebar.tsx:91-107
{filteredAndSortedFolders.map((folder, index) => (
  <div key={folder.path}>
    <MediaFolderListItemV2 {...folder} />
  </div>
))}
```

**建议**:
对于大量数据使用虚拟列表：
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedFolderList({ folders }) {
  const virtualizer = useVirtualizer({
    count: folders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  });
  // ...
}
```

### 4.3 WebSocket 消息处理

**问题描述**:
`useWebSocket.ts` 中所有事件都通过 Set 分发，每次消息都会遍历所有监听器：

```tsx
// useWebSocket.ts:215-221
for (const listener of webSocketEventListeners) {
  try {
    listener(message);
  } catch (error) {
    console.error('[Socket.IO] Error in event listener:', error);
  }
}
```

**建议**:
使用事件类型映射，只通知相关监听器：
```typescript
const eventListeners = new Map<string, Set<Listener>>();

function emit(event: string, data: any) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(listener => listener(data));
  }
}
```

---

## 五、代码质量问题

### 5.1 类型安全问题

**问题 1**: 大量 `any` 类型使用

```tsx
// main.tsx:87
sendAcknowledgement(message, { /* ... */ });

// useWebSocket.ts:71
export function sendAcknowledgement(message: WebSocketMessage, response: any): void
```

**问题 2**: 类型断言过多

```tsx
// TvShowPanelUtils.ts:739
} as TMDBEpisode)

// TvShowPanelUtils.ts:119
} as UIRecognizeMediaFilePlan
```

### 5.2 错误处理不完善

**问题描述**:
大量 try-catch 只打印日志，未向用户反馈：

```tsx
// media-metadata-provider.tsx:169-171
.catch((error) => {
  console.error(`[addMediaMetadata] Failed to write media metadata:`, error)
})
```

**建议**:
```tsx
.catch((error) => {
  console.error(`[addMediaMetadata] Failed to write media metadata:`, error);
  toast.error(t('errors.saveMetadataFailed'));
  // 可选：上报错误到监控系统
  reportError(error);
})
```

### 5.3 魔法字符串

**问题描述**:
硬编码的状态字符串：

```tsx
// 多处出现
status: 'ok'
status: 'initializing'
status: 'loading'
status: 'pending'
status: 'running'
status: 'succeeded'
status: 'failed'
status: 'aborted'
```

**建议**:
```typescript
// types/status.ts
export const MediaMetadataStatus = {
  OK: 'ok',
  INITIALIZING: 'initializing',
  LOADING: 'loading',
} as const;

export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  ABORTED: 'aborted',
} as const;
```

### 5.4 注释与 TODO

**问题描述**:
存在大量未处理的 TODO 和注释掉的代码：

```tsx
// App.tsx:381-386 (注释掉的代码)
// <div className="flex flex-col gap-4 p-4">
//   <Button onClick={handleOpenConfirmation}>Open Confirmation Dialog</Button>
//   ...

// TvShowPanel.tsx:433
// TODO: do I still need this wrapper?
```

### 5.5 国际化不完整

**问题描述**:
部分文本硬编码中文：

```tsx
// sidebar/Sidebar.tsx:43-45
const sortLabels: Record<SortOrder, string> = {
  alphabetical: "按字母顺序",
  "reverse-alphabetical": "按字母倒序",
}

// v2/Sidebar.tsx:74
placeholder="搜索媒体文件夹..."

// v2/Sidebar.tsx:87
没有找到媒体文件夹
```

**建议**:
统一使用 i18next：
```tsx
const { t } = useTranslation('sidebar');
placeholder={t('searchPlaceholder')}
```

---

## 六、测试问题

### 6.1 测试覆盖率

**当前状态**:
```
apps/ui/src/
├── components/
│   ├── FileExplorer.test.tsx    ✓
│   ├── TvShowPanel.test.tsx     ✓
│   └── TvShowPanelUtils.test.ts ✓
├── components/dialogs/
│   └── file-picker-dialog.test.tsx ✓
└── AppV2Utils.test.ts           ✓
```

**问题**:
- Provider 组件无测试
- Hooks 无测试
- 工具函数测试不完整

### 6.2 测试建议

```typescript
// __tests__/providers/media-metadata-provider.test.tsx
describe('MediaMetadataProvider', () => {
  it('should add media metadata', async () => {
    const { result } = renderHook(() => useMediaMetadata(), {
      wrapper: TestProviders,
    });

    await act(async () => {
      result.current.addMediaMetadata(mockMetadata);
    });

    expect(result.current.mediaMetadatas).toContainEqual(mockMetadata);
  });
});

// __tests__/hooks/useWebSocket.test.ts
describe('useWebSocket', () => {
  it('should connect to socket server', () => {
    // ...
  });

  it('should handle reconnection', () => {
    // ...
  });
});
```

---

## 七、重构计划

### Phase 1: 基础设施改进 (1-2 周)

**优先级**: 🔴 高

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 1.1 | 引入 Zustand 统一状态管理 | 3 天 |
| 1.2 | 配置 React Query 管理服务器状态 | 2 天 |
| 1.3 | 统一错误处理机制 | 1 天 |
| 1.4 | 添加错误边界组件 | 1 天 |
| 1.5 | 移除 DOM 事件通信，统一到 Zustand | 2 天 |

**代码示例 - Zustand Store**:
```typescript
// stores/appStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  // Media
  mediaMetadatas: UIMediaMetadata[];
  selectedMediaPath: string | null;

  // Plans
  pendingPlans: UIRecognizeMediaFilePlan[];
  pendingRenamePlans: RenameFilesPlan[];

  // Dialogs
  activeDialog: DialogType | null;

  // Jobs
  backgroundJobs: BackgroundJob[];

  // Actions
  actions: {
    selectMedia: (path: string) => void;
    addMetadata: (metadata: UIMediaMetadata) => void;
    openDialog: (type: DialogType) => void;
    closeDialog: () => void;
    // ...
  };
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        mediaMetadatas: [],
        selectedMediaPath: null,
        pendingPlans: [],
        pendingRenamePlans: [],
        activeDialog: null,
        backgroundJobs: [],

        actions: {
          selectMedia: (path) => set({ selectedMediaPath: path }),
          addMetadata: (metadata) => set((state) => ({
            mediaMetadatas: [...state.mediaMetadatas, metadata],
          })),
          openDialog: (type) => set({ activeDialog: type }),
          closeDialog: () => set({ activeDialog: null }),
        },
      }),
      { name: 'app-store' }
    )
  )
);

// 使用 selector 优化性能
export const useMediaMetadatas = () => useAppStore((state) => state.mediaMetadatas);
export const useAppActions = () => useAppStore((state) => state.actions);
```

### Phase 2: 组件重构 (2-3 周)

**优先级**: 🟡 中

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 2.1 | 拆分 TvShowPanel 组件 | 3 天 |
| 2.2 | 拆分 TMDBTVShowOverview 组件 | 2 天 |
| 2.3 | 重构 DialogProvider 为独立对话框 | 2 天 |
| 2.4 | 统一 Sidebar 组件 (合并 v1/v2) | 2 天 |
| 2.5 | 废弃 App.tsx，保留 AppV2 | 1 天 |
| 2.6 | 移除内联样式，统一使用 Tailwind | 2 天 |

**代码示例 - 组件拆分**:
```tsx
// components/TvShowPanel/index.tsx
export function TvShowPanel() {
  return (
    <TvShowPanelProvider>
      <TvShowPanelContent />
    </TvShowPanelProvider>
  );
}

// components/TvShowPanel/TvShowPanelContent.tsx
function TvShowPanelContent() {
  const { mediaMetadata } = useMediaMetadata();
  const { seasons } = useTvShowSeasons();
  const recognition = useTvShowRecognition();
  const renaming = useTvShowRenaming();

  return (
    <div className="tv-show-panel">
      <TvShowHeader
        tvShow={mediaMetadata?.tmdbTvShow}
        onRename={renaming.start}
        onRecognize={recognition.start}
      />
      <TvShowSeasonList
        seasons={seasons}
        isPreviewing={recognition.isPreviewing || renaming.isPreviewing}
      />
      <TvShowPrompts />
    </div>
  );
}
```

### Phase 3: 性能优化 (1 周)

**优先级**: 🟡 中

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 3.1 | 添加列表虚拟化 | 2 天 |
| 3.2 | 优化 WebSocket 事件分发 | 1 天 |
| 3.3 | 添加组件懒加载 | 1 天 |
| 3.4 | 优化重渲染 (useMemo/useCallback) | 1 天 |

### Phase 4: 代码质量提升 (1 周)

**优先级**: 🟢 低

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 4.1 | 消除 any 类型 | 2 天 |
| 4.2 | 提取常量，消除魔法字符串 | 1 天 |
| 4.3 | 完善 i18n | 2 天 |
| 4.4 | 清理 TODO 和注释代码 | 1 天 |

### Phase 5: 测试完善 (持续)

**优先级**: 🟡 中

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 5.1 | Provider 单元测试 | 2 天 |
| 5.2 | Hooks 单元测试 | 2 天 |
| 5.3 | 组件集成测试 | 3 天 |
| 5.4 | E2E 测试关键流程 | 3 天 |

---

## 八、目录结构重构建议

### 当前结构问题
```
apps/ui/src/
├── components/          # 组件混乱，无清晰分类
│   ├── ui/             # shadcn 组件
│   ├── dialogs/       # 对话框
│   ├── eventlisteners/ # 事件监听器
│   ├── sidebar/       # 侧边栏
│   ├── v2/            # v2 版本组件
│   └── ...            # 其他组件散落各处
├── providers/          # 所有 Provider 平铺
└── ...
```

### 建议结构
```
apps/ui/src/
├── app/                          # 应用层
│   ├── App.tsx                   # 主应用入口
│   ├── AppProvider.tsx           # 统一 Provider
│   └── routes/                   # 路由配置
│
├── features/                     # 功能模块 (按领域划分)
│   ├── media/                    # 媒体管理
│   │   ├── components/
│   │   │   ├── MediaPanel/
│   │   │   ├── TvShowPanel/
│   │   │   ├── MoviePanel/
│   │   │   └── MusicPanel/
│   │   ├── hooks/
│   │   │   ├── useMediaMetadata.ts
│   │   │   └── useMediaRecognition.ts
│   │   ├── stores/
│   │   │   └── mediaStore.ts
│   │   └── types/
│   │       └── media.ts
│   │
│   ├── sidebar/                  # 侧边栏
│   │   ├── components/
│   │   ├── hooks/
│   │   └── stores/
│   │
│   └── ai-assistant/             # AI 助手
│       ├── components/
│       ├── hooks/
│       └── tools/
│
├── shared/                       # 共享资源
│   ├── components/               # 通用组件
│   │   ├── ui/                   # shadcn/ui
│   │   ├── dialogs/              # 对话框
│   │   └── layouts/              # 布局组件
│   │
│   ├── hooks/                    # 通用 hooks
│   │   ├── useWebSocket.ts
│   │   └── useAsync.ts
│   │
│   ├── stores/                   # 全局 stores
│   │   ├── appStore.ts
│   │   └── uiStore.ts
│   │
│   ├── api/                      # API 客户端
│   │   ├── client.ts
│   │   └── endpoints/
│   │
│   └── lib/                      # 工具库
│       ├── utils.ts
│       ├── path.ts
│       └── i18n/
│
└── types/                        # 全局类型
    ├── global.d.ts
    └── api.ts
```

---

## 九、技术债务清单

| ID | 描述 | 严重程度 | 状态 |
|----|------|----------|------|
| TD-001 | 双版本应用共存 (App/AppV2) | 🔴 高 | 待处理 |
| TD-002 | DOM 事件与 Context 混用 | 🔴 高 | 待处理 |
| TD-003 | DialogProvider 管理过多状态 | 🟡 中 | 待处理 |
| TD-004 | TvShowPanel 组件过大 | 🟡 中 | 待处理 |
| TD-005 | 缺少错误边界 | 🟡 中 | 待处理 |
| TD-006 | 测试覆盖不足 | 🟡 中 | 待处理 |
| TD-007 | 国际化不完整 | 🟢 低 | 待处理 |
| TD-008 | 魔法字符串 | 🟢 低 | 待处理 |
| TD-009 | any 类型过多 | 🟢 低 | 待处理 |
| TD-010 | 内联样式与 Tailwind 混用 | 🟢 低 | 待处理 |

---

## 十、监控与度量

### 建议添加的指标

1. **性能指标**
   - 首屏加载时间 (FCP)
   - 最大内容绘制时间 (LCP)
   - 累积布局偏移 (CLS)
   - 首次输入延迟 (FID)

2. **代码质量指标**
   - 测试覆盖率 (目标: 80%)
   - TypeScript 严格模式通过率
   - ESLint 错误/警告数量
   - Bundle 大小

3. **用户体验指标**
   - 错误发生率
   - API 响应时间
   - WebSocket 连接稳定性

### 实施建议

```typescript
// lib/analytics.ts
export function initAnalytics() {
  // Web Vitals
  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);

  // 错误监控
  window.addEventListener('error', (event) => {
    reportError(event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason);
  });
}
```

---

## 十一、总结

### 优先级排序

1. **立即处理** (1-2 周内)
   - 引入 Zustand 统一状态管理
   - 移除 DOM 事件通信
   - 添加错误边界

2. **短期处理** (1 个月内)
   - 组件拆分 (TvShowPanel, TMDBTVShowOverview)
   - 统一 Sidebar 组件
   - 废弃 App.tsx

3. **中期处理** (1-3 个月)
   - 性能优化 (虚拟列表、懒加载)
   - 测试完善
   - 代码质量提升

4. **长期处理** (持续)
   - 国际化完善
   - 目录结构重组
   - 技术债务清理

### 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 状态管理重构影响现有功能 | 高 | 分阶段迁移，保持向后兼容 |
| 组件拆分引入新 bug | 中 | 增加测试覆盖，渐进式重构 |
| 性能优化引入复杂性 | 中 | 评估 ROI，按需优化 |

### 成功标准

- [ ] 测试覆盖率达到 80%
- [ ] 首屏加载时间 < 2s
- [ ] TypeScript 严格模式 0 错误
- [ ] ESLint 0 错误
- [ ] 所有 TODO 已处理或转为 Issue
- [ ] 国际化 100% 完成
