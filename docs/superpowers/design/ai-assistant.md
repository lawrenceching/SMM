# AI Assistant

SMM 提供两套**并行**的 AI Assistant transport — 桌面默认走后端 `POST /api/chat`，HarmonyOS / feature flag 走浏览器内 `streamText`。

## 1. Dual Architecture

| 维度 | Backend path (桌面默认) | Frontend path (HarmonyOS / flag) |
|---|---|---|
| Transport | `AssistantChatTransport` → `POST /api/chat` | `ReverseProxyChatTransport` → in-process `streamText` |
| LLM 调用位置 | `packages/core-routes` `doChat`（`apps/cli` Hono shell） | `apps/ui` renderer（via reverse proxy） |
| 工具执行 | Bun/Node 服务端（`core-routes/src/tools/`） | 浏览器（HTTP API、`requestConfirmation` 等） |
| Plan 存储 | `{appDataDir}/plans/*.plan.json`（服务端写入） | 同上（HTTP `createPlan` / `updatePlan`） |
| 确认弹窗 | Socket.IO `askForConfirmation` | `confirmationBridge` + `AIBasedConfirmationBridge` |
| 触发 | 桌面 / Docker 默认 | `isHarmonyOS()` 或 `isUIAiChatTransportEnabled` |

**关键设计原则**：同样的 `toolName`（kebab-case）、同样的 Zod schema（`packages/core/types/ai-tools/`）、语义一致的返回（`toolOk` / `toolError`）。**但每个 tool 只在一条 transport 上执行** — 见 §1.1。

### 1.1 Task tools：单路径执行（避免重复 Plan）

Rename / recognize 的 6 个 task 工具在 registry 中同时标记 `backend: true` 与 `frontend: true`，但**不能**在桌面同时挂载前端 `execute` 与后端 `execute`：assistant-ui 会在参数就绪时运行浏览器侧 `makeAssistantTool.execute`，而 `/api/chat` 也会运行服务端工具，曾导致重复 `createPlan`（orphan plan id 1 + LLM 使用的 id 2）。

| Transport | Task tools 执行位置 | 前端组件挂载 |
|-----------|-------------------|-------------|
| `AssistantChatTransport`（桌面默认） | 仅 `doChat` → `core-routes` `renameFilesTask` / `recognizeMediaFilesTask` | **不挂载** 6 个 task `makeAssistantTool`（无浏览器 `execute`） |
| `ReverseProxyChatTransport` | 仅浏览器 `BeginRenameFilesTask` 等 → HTTP plan API | **挂载** 6 个 task 组件 |

`Assistant.tsx` 用 `useFrontendTransport = isHarmony || isUIAiChatTransportEnabled` 同时选择 transport 与是否挂载 task tools。非 task 工具（如 `getApplicationContext`）在桌面仍注册前端 schema；服务端在 `tools` 对象中按 key 覆盖 `execute`（服务端优先）。

## 2. Assistant Wiring

```
Assistant.tsx
  → useFrontendTransport = isHarmonyOS() || isUIAiChatTransportEnabled?
    Yes → ReverseProxyChatTransport + ToolsBridge.setTools(useAssistantTools)
          + mount begin/add/end rename & recognize task tools
    No  → AssistantChatTransport (POST /api/chat → doChat)
          + mount read/mutating tools only (no task tool execute in renderer)
```

`ToolsBridge` 仅在 `ReverseProxyChatTransport` 下把 `useAssistantTools()` 注入 transport；桌面路径由服务端 `streamText` 自带完整 tool 定义。

## 3. Reverse Proxy & LLM Routing

浏览器端 AI 调用不直连外部 provider，而是通过 backend reverse proxy：

```
ReverseProxyChatTransport → POST /ai/proxy (header: X-SMM-Proxy-Upstream-BaseURL)
  → reverseProxyNode.ts → validate baseURL allowlist → forward to LLM provider
```

`apiKey` 在 proxy 端解析（来自 `userConfig.aiProviders`），不暴露给浏览器。proxy 不可用时 → 显示 "Open Settings → AI to configure" 提示。

## 4. AI Feature Toggle

`isAiFeatureEnabled` 全局开关（`useFeatures.ts`），控制所有 AI 相关组件：
- `<Assistant />` AI chat overlay
- `<AiBasedRecognizePrompt />` episode recognition
- AI-based rename prompts

持久化在 localStorage `features.isAiFeatureEnabled`，默认 `true`。

## 5. AI Settings Combobox

设置页 Provider Name / Model 输入框改为 Shadcn UI Combobox：
- Provider Name: 预设 OpenAI 兼容提供商 + 自定义输入
- Model: 上下文推荐的模型列表 + 自定义输入
- 仅优化 `apps/ui` 体验，不修改 `packages/core` 或 `apps/cli` API

## 6. AI Area Layout

桌面布局右侧添加可调整大小的 AI Area 面板（使用 `ResizablePanelGroup`）。当前为空白占位符。

```
Before: Sidebar | Content
After:  Sidebar | Content | AI Area (resizable)
```

## 7. Frontend AI Tools

14 个工具在 `packages/core/ai-tool/registry.ts` 登记；浏览器侧 `makeAssistantTool` 实现见 `apps/ui/src/ai/tools/`。

| Tool | Data Source (frontend path) | 桌面 `/api/chat` 执行 |
|------|---------------------------|----------------------|
| `get-app-context` | Zustand + `useConfig` + `useHelloQuery` | 服务端（key 覆盖） |
| `is-folder-exist` | `POST /api/isFolderAvailable` | 服务端 |
| `get-media-metadata` | TanStack Query cache | 服务端 |
| `get-episodes` | `POST /api/getEpisodes` | 服务端 |
| `get-media-folders` | `readUserConfig()` | 服务端 |
| `list-files-in-media-folder` | `POST /api/listFilesInMediaFolder` | 服务端 |
| `rename-folder` | `requestConfirmation` + API | 服务端 |
| `begin/add/end-rename-files-task` | HTTP `createPlan`/`updatePlan` + `aiPlanDrafts` | **仅服务端**（前端不挂载 execute） |
| `begin/add/end-recognize-task` | 同上 | **仅服务端** |

前端 transport 下 task 工具：`createPlan({ creator: 'ai' })` → `setPlanDraft` → `invalidateQueries(['plans'])`；终态时 `deletePlanDraft`。

## 8. HarmonyOS Migration

### Phase 1: Chat-only
HarmonyOS 默认 `useFrontendTransport` → `ReverseProxyChatTransport`，不依赖 `/api/chat`。

### Phase 2: Client-side Tools
`getApplicationContext` 等 client-side `makeAssistantTool`；task 工具在 HarmonyOS 走 HTTP plan API（与桌面服务端路径互斥）。

### Phase 3: AI Connectivity Check
`POST /api/ai/check` 移除，设置页 "Check" 按钮改为浏览器端通过 reverse proxy 验证。

## 9. Tool Architecture

### Shared Pattern

| 层 | 职责 |
|---|------|
| `packages/core/types/ai-tools/` | Tool name 常量、Zod schema、description |
| `packages/core/ai-tool/registry.ts` | 登记 backend / frontend 暴露范围 |
| `packages/core/ai-tool/` | 统一 `toolOk` / `toolError` 返回值 |
| `packages/core/plan/` | Plan 领域逻辑 |
| `packages/core-routes/src/tools/` | 服务端 tool `execute`（`ChatFs` 写 plan 文件） |
| `apps/ui/src/ai/tools/` | 浏览器 path 的 `makeAssistantTool` 实现 |

### Confirmation (Two Mechanisms)

- **Backend path**: Socket.IO `askForConfirmation` → browser dialog → `acknowledge()`
- **Frontend path**: `confirmationBridge.ts` + `AIBasedConfirmationBridge` React 弹窗

### Plan 与 TvShowPanel

AI 创建的 plan（`creator: 'ai'`）经 `usePlansQuery` + `selectActiveAiPlan` 进入 `useAiBasedRenameFilesFlow` / `useAiBasedRecognizeFlow`，与 rule-based plan 一样驱动表格预览与 `AiBasedRenameFilePrompt` / `AiBasedRecognizePrompt`。详见 `episode-rename-recognize.md`。

## 10. Adding a New Tool

1. Define contract in `packages/core/types/ai-tools/`
2. Add entry to `packages/core/ai-tool/registry.ts`
3. Implement server tool in `packages/core-routes/src/tools/`（并在 `chat.ts` `tools` 对象注册）
4. Implement frontend tool in `apps/ui/src/ai/tools/`（若 `frontend: true`）
5. Mount in `Assistant.tsx`（task 类工具若仅一端执行，按 §1.1 条件挂载）
6. HTTP API + route if needed
7. Plan lifecycle: `packages/core-routes/src/tools/plans.ts` + TanStack Query hooks
8. Confirmation: `requestConfirmation()` 或 Socket.IO acknowledge

## 11. Key Files

| File | Role |
|------|------|
| `apps/ui/src/ai/Assistant.tsx` | Transport 选择；条件挂载 task tools |
| `apps/ui/src/ai/transport/reverseProxyChatTransport.ts` | In-process AI SDK `streamText` |
| `apps/ui/src/ai/hooks/useAssistantTools.ts` | `ToolsBridge` 工具收集 |
| `apps/ui/src/ai/confirmationBridge.ts` | In-process confirmation |
| `apps/ui/src/ai/plan/aiPlanDrafts.ts` | 前端 transport 下 plan 内存草稿 |
| `apps/ui/src/ai/prompts.ts` | System prompts |
| `packages/core-routes/src/chat.ts` | `doChat` + `streamText` tools 合并 |
| `packages/core-routes/src/tools/` | 14 个服务端 agent tools |
| `packages/core/ai-tool/registry.ts` | Tool 登记与 path 标志 |
| `packages/core/types/ai-tools/` | Shared tool contracts |
| `packages/core-routes/src/reverseProxy.ts` | Reverse proxy |
| `apps/cli/src/route/chatRoute.ts` | Hono shell → `doChat` |
