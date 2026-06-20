# Episode Rename & Recognize

电视剧集的重命名与识别操作设计，支持 3 种触发来源：UI、内置 AI Assistant、MCP Tool。所有路径共享统一的 Plan 机制。

## 1. Plan-Based Actions

所有的识别和重命名操作均基于 **Plan** 机制实现。

**设计原则**: 用户操作应立即得到 UI 响应 (Immediate UI Response)。

### Plan 持久化与状态管理

Plan 是 **server state**，统一由 `packages/core-routes` 持久化为 `appDataDir/plans/*.plan.json`，
前端通过 TanStack Query (`usePlansQuery` / `useCreatePlanMutation` / `useUpdatePlanMutation`) 读写，
不再使用 Zustand `plansStore` 或浏览器 IndexedDB。`PlanReady` Socket.IO 事件触发 `['plans']` query 失效以同步缓存。

每个 plan 带有 `creator` 字段区分来源：

- `creator: "app"` — 规则驱动 (UI 按钮触发) 的 plan
- `creator: "ai"` — AI Assistant / MCP 生成的 plan

### Plan 生命周期 (`status`)

```
preparing → pending → completed
    │          │
    └──────────┴────→ rejected
```

- `preparing`: plan 已创建，文件内容 (files) 仍在计算/累积中
- `pending`: 内容就绪，等待用户确认
- `completed` / `rejected`: 终态。AI 端的内存草稿 (`aiPlanDrafts`) 在终态时清理

### Action Types

| Action | Plan Type | 来源 |
|--------|-----------|------|
| Recognize TV Show/Movie | `RecognizeTvShowOrMoviePlan` | UI |
| Recognize Episode by Rule | `RecognizeEpisodePlan` | UI |
| Recognize Episode by AI | `RecognizeEpisodePlan` | AI Assistant / MCP |
| Rename Episode by Rule | `RenameEpisodePlan` | UI |
| Rename Episode by AI | `RenameEpisodePlan` | AI Assistant / MCP |

## 2. Rename Episodes

### 2.1 Three Sources

| Aspect | UI RuleBased | AI Assistant | MCP Tool |
|---------|-------------|-------------|----------|
| User Interface | Buttons + dialogs | Chat conversation | External MCP client |
| Task Storage | File-based (`plans/*.plan.json`, `creator:"app"`) | In-memory draft (`aiPlanDrafts`) → file on `end` (`creator:"ai"`) | File-based (`plans/*.plan.json`, `creator:"ai"`) |
| Validation | `validateRenameOperations` | `validateRenameOperations` | `validateRenameOperations` |
| Confirmation | UI dialog | Socket.IO → UI dialog | Socket.IO → UI dialog |
| Execution | `POST /api/renameFiles` with `mediaFolder` | `executeBatchRenameOperations` | `POST /api/renameFiles` with `mediaFolder` |
| Metadata Update | In-process (same request) | Direct | In-process (same request) |
| Broadcast | `mediaMetadataUpdated` via Socket.IO | Same | Same |

### 2.2 UI RuleBased Flow

```
TVShowHeader (Rename button)
  → RuleBasedRenameFilePrompt dialog (select Plex/Emby rule)
  → useTvShowFileNameGeneration hook (generate preview names)
  → User confirms
  → useTvShowRenaming.startToRenameFiles()
  → renameBatch(videoFiles) → POST /api/renameFiles
  → renameBatch(associatedFiles) → POST /api/renameFiles
  → Backend: validateRenameOperations → executeBatchRenameOperations → updateMediaMetadataAndBroadcast
  → Toast result + refreshMediaMetadata
```

**Key components:**
- `useTvShowRenaming.ts` — core rename logic
- `useTvShowFileNameGeneration.ts` — preview generation
- `tvShowPromptsStore.ts` — dialog state management

### 2.3 AI Assistant Flow

```
User chat message → POST /api/chat
  → AI registers 3 tools:
    beginRenameFilesTaskV2(mediaFolderPath) → taskId
    addRenameFileToTaskV2(taskId, from, to) × N
    endRenameFilesTaskV2(taskId)
  → Socket.IO broadcasts: beginEvent / addFileEvent / endEvent
  → UI shows confirmation dialog
  → executeBatchRenameOperations → updateMediaMetadataAndBroadcast
```

### 2.4 MCP Tool Flow

External MCP client calls tools (begin/add/end-rename-episode-video-file). Plans stored as `plans/*.plan.json`. UI receives `RenameFilesPlanReady` event → confirmation → `POST /api/renameFiles`.

### 2.5 Shared Backend

| Component | File | Role |
|-----------|------|------|
| `validateRenameOperations` | `renameFilesInBatch.ts` | Single validation entry point |
| `executeBatchRenameOperations` | `renameFileUtils.ts` | Batch execution |
| `updateMediaMetadataAndBroadcast` | `renameFileUtils.ts` | Metadata update + broadcast |

## 3. Rule-based Recognize — Episode Validation

在 `RuleBasedRecognizePrompt` 中校验识别 plan 是否覆盖了电视剧的全部 episodes。

### 3.1 Architecture

```
TvShowPanel → buildTemporaryRecognitionPlanAsync → plan.files[]
TvShowPanelPrompts → RuleBasedRecognizePrompt
  → isRuleBasedRecognizePlanComplete(plan, mediaMetadata)
  → notAllEpisodesRecognized flag
```

### 3.2 Validation Logic

`isRuleBasedRecognizePlanComplete` — 对比 tvShow seasons 的全部 `(season, episode)` 与 `plan.files` 已覆盖的集合。未全部覆盖时显示提醒文案。

### 3.3 Episode Table Row States

| State | `checked` | `disabled` | Display |
|-------|-----------|------------|---------|
| In plan + new path | `true` | `false` | 正常显示 plan 路径 |
| In plan + same as mediaFiles | `false` | `true` | 灰色只读 (无变更) |
| Not in plan | `false` | `true` | 灰色只读 (保留已有) |

全部 plan 文件与 mediaFiles 一致时 → 显示 `allPlanFilesUnchanged` 提醒，禁用确认按钮。
