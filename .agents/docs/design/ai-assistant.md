# AI Assistant

SMM 提供两套**并行**的 AI Assistant 实现 — Bun 后端运行（桌面）和浏览器运行（HarmonyOS / feature flag）。

## 1. Dual Architecture

| 维度 | Backend (Bun) | Frontend (Browser) |
|---|---|---|
| Transport | `AssistantChatTransport` → `POST /api/chat` | `ReverseProxyChatTransport` → in-process `streamText` |
| LLM 调用位置 | `apps/cli` (Bun) | `apps/ui` (renderer, via reverse proxy) |
| 工具执行 | Bun 服务器 (fs, Socket.IO) | Browser (fetch, IndexedDB) |
| Plan 存储 | `{userDataDir}/plans/*.plan.json` | IndexedDB (`planStore.ts`) |
| 确认弹窗 | Socket.IO `askForConfirmation` | In-process `requestConfirmation` + DOM event |
| 触发 | 桌面默认 | HarmonyOS / `isUIAiChatTransportEnabled` flag |

**关键设计原则**：两套实现互为补充，不互相替代。同样的 `toolName`（kebab-case）、同样的 Zod schema（来自 `packages/core`）、语义一致的返回（`toolOk` / `toolError`）。

## 2. Assistant Wiring

```
Assistant.tsx
  → isHarmonyOS or isUIAiChatTransportEnabled?
    Yes → ReverseProxyChatTransport (in-browser streamText via reverse proxy)
    No  → AssistantChatTransport (POST /api/chat → ChatTask.ts)
```

`ToolsBridge` 监听 assistant-ui runtime 的工具注册变化，把工具列表注入 transport。

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

9 个前端 AI 工具实现，对齐 backend `ChatTask.ts`:

| Tool | Data Source (frontend) |
|------|----------------------|
| `getApplicationContext` | Zustand + `useConfig` + `useHelloQuery` |
| `is-folder-exist` | `POST /api/isFolderAvailable` |
| `get-media-metadata` | TanStack Query cache (mediaMetadataToolBridge) |
| `get-episodes` | `POST /api/getEpisodes` |
| `get-media-folders` | `readUserConfig()` → `smm.json` |
| `list-files-in-media-folder` | `POST /api/listFilesInMediaFolder` |
| `rename-folder` | `requestConfirmation` + `POST /api/renameFolder` |
| `begin/add/end-rename-files-task` | `planStore` (IndexedDB) + validation |
| `begin/add/end-recognize-task` | `planStore` (IndexedDB) |

## 8. HarmonyOS Migration

### Phase 1: Chat-only
HarmonyOS 默认使用 `ReverseProxyChatTransport`（in-process streamText via reverse proxy），不依赖 `/api/chat`。

### Phase 2: Client-side Tools
`getApplicationContext` 迁移到 client-side `makeAssistantTool`，从 Zustand `useUIMediaFolderStore` 读取选中文件夹。Transport 接受 `tools` map 实现工具注册。

### Phase 3: AI Connectivity Check
`POST /api/ai/check` 移除，设置页 "Check" 按钮改为浏览器端通过 reverse proxy 直连 AI provider 验证。

## 9. Tool Architecture

### Shared Pattern

| 层 | 职责 |
|---|------|
| `packages/core/types/ai-tools/` | Tool name 常量、Zod schema、description |
| `packages/core/ai-tool/` | 统一 `toolOk` / `toolError` 返回值 |
| `packages/core/plan/` | Plan 创建、追加、校验逻辑 |
| CLI / UI | 薄 storage adapter（Bun.file / IndexedDB） |

### Confirmation (Two Mechanisms)

- **Backend**: Socket.IO `askForConfirmation` → browser dialog → `acknowledge()`
- **Frontend**: `confirmationBridge.ts` Promise + `document.dispatchEvent('smm-ai-confirmation-request')` → `AIBasedConfirmationBridge` React 弹窗

## 10. Adding a New Tool

1. Define contract in `packages/core/types/ai-tools/`
2. Implement server-side tool in `apps/cli/src/tools/`
3. Implement frontend tool in `apps/ui/src/ai/tools/`
4. Mount in `Assistant.tsx`
5. HTTP API + route if needed
6. Plan lifecycle: domain logic in `packages/core/plan/`, thin adapters in cli/ui
7. Confirmation: `requestConfirmation()` from `confirmationBridge.ts`

## 11. Key Files

| File | Role |
|------|------|
| `apps/ui/src/ai/Assistant.tsx` | Entry point; transport selection; stale plan cleanup |
| `apps/ui/src/ai/transport/reverseProxyChatTransport.ts` | In-process AI SDK streamText |
| `apps/ui/src/ai/hooks/useAssistantTools.ts` | ToolsBridge |
| `apps/ui/src/ai/confirmationBridge.ts` | In-process confirmation |
| `apps/ui/src/ai/planStore.ts` | IndexedDB plan CRUD |
| `apps/ui/src/ai/prompts.ts` | System prompts |
| `apps/cli/tasks/ChatTask.ts` | Backend chat handler |
| `apps/cli/src/tools/` | 14 server-side agent tools |
| `packages/core/types/ai-tools/` | Shared tool contracts |
| `packages/core-routes/src/reverseProxy.ts` | Reverse proxy |
