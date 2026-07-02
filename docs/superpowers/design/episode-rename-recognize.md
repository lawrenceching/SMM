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
- `completed` / `rejected`: 终态。前端 transport 下的内存草稿 (`aiPlanDrafts`) 在终态时清理

### UI：统一 plan 驱动预览与 prompt

`TvShowPanel` 合并多路 plan 驱动剧集表预览模式：

```
plan = renameFlow.plan ?? aiRenameFlow.plan ?? recognizeFlow.plan ?? aiRecognizeFlow.plan
```

| 来源 | Hook | `creator` | Prompt 打开方式 |
|------|------|-----------|----------------|
| Rule-based rename | `useRuleBasedRenameFilesFlow` | `app` | `tvShowPromptsStore.ruleBasedRenameFilePrompt` |
| AI rename | `useAiBasedRenameFilesFlow` | `ai` | `TvShowPanelPrompts`：`isOpen={aiRenamePlan !== undefined}` |
| Rule-based recognize | `useRuleBasedRecognizeFlow` | `app` | `tvShowPromptsStore.ruleBasedRecognizePrompt` |
| AI recognize | `useAiBasedRecognizeFlow` | `ai` | `TvShowPanelPrompts`：`isOpen={aiRecognizePlan !== undefined}` |

`selectActiveAppPlan` / `selectActiveAiPlan`（`selectActiveAppPlan.ts`）从 `usePlansQuery` 结果中选取当前文件夹下 `preparing` / `pending` 的 plan。AI flow hooks 返回 `{ plan, promptStatus, onConfirm, onCancel }`，不再通过 Zustand 单独维护 AI prompt 的 `isOpen`。

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

| Aspect | UI RuleBased | AI Assistant (桌面) | AI Assistant (前端 transport) | MCP Tool |
|---------|-------------|---------------------|------------------------------|----------|
| User Interface | Buttons + dialogs | Chat | Chat | External MCP client |
| Task Storage | `plans/*.plan.json`, `creator:"app"` | 服务端 `beginRenamePlan` 写文件, `creator:"ai"` | HTTP `createPlan`/`updatePlan`, `creator:"ai"` + `aiPlanDrafts` | `plans/*.plan.json`, `creator:"ai"` |
| Tool 执行 | N/A | 仅 `doChat` 服务端 tools | 仅浏览器 `makeAssistantTool` | MCP server |
| Validation | `validateRenameOperations` | 同左 | 同左 | 同左 |
| UI 确认 | Rule-based prompt | `AiBasedRenameFilePrompt` | 同左 | `RenameFilesPlanReady` → prompt |
| Execution | `POST /api/renameFiles` | 用户确认后同左 | 同左 | 同左 |
| Metadata Update | In-process | 同左 | 同左 | 同左 |
| Broadcast | `mediaMetadataUpdated` | 同左 | 同左 | 同左 |

桌面 AI 路径**不在浏览器执行** task tool `execute`（避免与 `doChat` 重复创建 plan）。见 `ai-assistant.md` §1.1。

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
- `tvShowPromptsStore.ts` — **仅** rule-based dialog 状态（NFO / rule-based rename / rule-based recognize）

### 2.3 AI Assistant Flow (桌面 `/api/chat`)

```
User chat → POST /api/chat → doChat → streamText
  → LLM 调用 3 个 kebab-case tools（服务端 execute）:
    begin-rename-files-task(mediaFolderPath) → taskId (plan id)
    add-rename-file-to-task(taskId, from, to) × N
    end-rename-files-task(taskId) → status pending + Socket.IO RenameFilesPlanReady
  → invalidateQueries(['plans']) / PlanReady 监听器
  → selectActiveAiPlan → useAiBasedRenameFilesFlow.plan
  → TvShowPanel 预览模式 + AiBasedRenameFilePrompt
  → 用户确认 → onAppRenameConfirm → POST /api/renameFiles
```

浏览器侧**不挂载** `BeginRenameFilesTaskTool` 等组件，因此不会额外 `POST /api/createPlan`。

### 2.4 AI Assistant Flow (前端 transport)

```
User chat → ReverseProxyChatTransport → streamText (renderer)
  → makeAssistantTool execute:
    BeginRenameFilesTask → POST /api/createPlan (creator ai)
    AddRenameFileToTask → POST /api/updatePlan
    EndRenameFilesTask → POST /api/updatePlan (pending) + invalidate plans
  → 同上：usePlansQuery → preview + AiBasedRenameFilePrompt
```

### 2.5 MCP Tool Flow

External MCP client calls tools (begin/add/end-rename-episode-video-file). Plans stored as `plans/*.plan.json`. UI receives `RenameFilesPlanReady` event → confirmation → `POST /api/renameFiles`.

### 2.6 Shared Backend

| Component | File | Role |
|-----------|------|------|
| `validateRenameOperations` | `renameFilesInBatch.ts` | Single validation entry point |
| `executeBatchRenameOperations` | `renameFileUtils.ts` | Batch execution |
| `updateMediaMetadataAndBroadcast` | `renameFileUtils.ts` | Metadata update + broadcast |
| `beginRenamePlan` / `appendRenamePlanEntry` | `core-routes/tools/plans.ts` | Plan 文件 I/O |

## 3. Rule-based Recognize — Episode Validation

在 `RuleBasedRecognizePrompt` 中校验识别 plan 是否覆盖了电视剧的全部 episodes。

### 3.1 Architecture

```
TvShowPanel → buildTemporaryRecognitionPlanAsync → plan.files[]
TvShowPanelPrompts → RuleBasedRecognizePrompt
  → isRuleBasedRecognizePlanComplete(plan, mediaMetadata)
  → notAllEpisodesRecognized flag
```

AI recognize 使用 `useAiBasedRecognizeFlow` + `AiBasedRecognizePrompt`，与 rule-based 对称，不经过 `tvShowPromptsStore`。

### 3.2 Validation Logic

`isRuleBasedRecognizePlanComplete` — 对比 tvShow seasons 的全部 `(season, episode)` 与 `plan.files` 已覆盖的集合。未全部覆盖时显示提醒文案。

### 3.3 Episode Table Row States

| State | `checked` | `disabled` | Display |
|-------|-----------|------------|---------|
| In plan + new path | `true` | `false` | 正常显示 plan 路径 |
| In plan + same as mediaFiles | `false` | `true` | 灰色只读 (无变更) |
| Not in plan | `false` | `true` | 灰色只读 (保留已有) |

全部 plan 文件与 mediaFiles 一致时 → 显示 `allPlanFilesUnchanged` 提醒，禁用确认按钮。
