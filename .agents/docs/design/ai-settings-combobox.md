# AI Settings Combobox

将设置页 **AI** 标签中的 Provider Name、Model 输入框改为 Shadcn UI Combobox，提供主流提供商/模型快捷选择，并支持自定义任意文本。仅优化 `apps/ui` 体验，**不修改** `packages/core` 用户配置结构或 `apps/cli` API。

[x] New UI component - check this if new UI component added
[ ] New user config - check this if new user config introduced
[ ] Electron only - check this if new feature only work in Electron env.
[ ] User document - check this if this change requires to add/update/delete user documents in `docs` folder

## 1. Background

当前 `AiSettings.tsx` 使用普通 `<Input>` 填写 `name`、`model`。用户需手动查文档填写 baseURL 与模型名，易出错、体验差。

项目已安装 `@/components/ui/combobox.tsx`（Base UI Combobox）。本变更：

- Provider Name：预设主流 OpenAI 兼容提供商 + 可输入自定义名称
- Model：根据当前提供商上下文展示推荐模型列表 + 可输入自定义模型名
- 选择**预设提供商**时：若 `baseURL` / `model` 为空则填入预设；**保留**已有 `apiKey` 与用户已填写的 URL/模型

## 2. Project Level Architecture

none

## 3. App Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/ui/src/components/ui/settings/AiSettings.tsx          │
│    ├── AiProviderNameCombobox (per card)                    │
│    └── AiModelCombobox (per card)                           │
│              ▲                                              │
│              │ reads                                        │
│  apps/ui/src/lib/ai-provider-presets.ts                     │
│    COMMON_AI_PROVIDERS: AiProvider[]                        │
│    findPresetByName(), getModelOptions()                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ save unchanged
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  UserConfig.aiProviders: OpenAICompatibleConfig[]           │
│  (packages/core — no schema change)                         │
└─────────────────────────────────────────────────────────────┘
```

`AiSettingsStringCombobox.tsx` 基于 `@/components/RadixDialogCompatibleCombobox`（Radix Popover `modal={false}` + Input 锚点，与 `ImmersiveSearchbox` 同模式），**不**依赖 Base UI combobox。下拉展示全量 `options`（输入时通过 `mergeCustomValue` 合并当前输入）。

### Dialog 内下拉可点击

Radix Dialog + 默认 Portal 到 `body` 会导致浮层点击穿透；应用层使用 `RadixDialogCompatibleCombobox`，不修改 `components/ui/combobox.tsx` 与 `dialog.tsx`。

## 4. User Stories

### 4.1 选择预设 AI 提供商

* **Given** 用户打开 AI 设置且某张 provider 卡的 baseURL、model 为空
* **When** 在 Provider Name combobox 中选择「DeepSeek」
* **Then** `name` 设为 `DeepSeek`，`baseURL` 填入 `https://api.deepseek.com`，`model` 填入该预设的默认模型（列表第一项）；`apiKey` 不变

### 4.2 已有配置时不覆盖

* **Given** 用户已填写 baseURL 或 model
* **When** 从 combobox 选择另一预设提供商名称
* **Then** 仅更新 `name`（及校验逻辑）；**不**覆盖非空的 baseURL / model

### 4.3 自定义提供商与模型

* **Given** 用户在 Provider Name 或 Model combobox 中输入不在列表中的文本
* **When** 输入完成（失焦或确认）
* **Then** 接受该自定义字符串为 `name` 或 `model`；不触发预设 baseURL/model 填充（除非 name 恰好匹配某预设且对应字段为空）

### 4.4 模型列表随提供商变化

* **Given** 当前 provider 的 `name` 匹配某预设（如 OpenAI）
* **When** 打开 Model combobox
* **Then** 下拉展示该预设的 `models` 数组；若 `name` 为自定义或不匹配预设，则仅展示当前 `model`（若有）作为可选项，并仍允许自由输入

```mermaid
sequenceDiagram
  participant User
  participant NameCombo as AiProviderNameCombobox
  participant Presets as ai-provider-presets
  participant State as AiSettings state

  User->>NameCombo: select "OpenAI"
  NameCombo->>Presets: findPresetByName("OpenAI")
  Presets-->>NameCombo: { baseUrl, models }
  NameCombo->>State: set name; if baseURL empty then set baseURL
  NameCombo->>State: if model empty then set model = models[0]
  Note over State: apiKey unchanged
```

## 5. Tasks

### 5.1 数据与工具

[x] 新增 `apps/ui/src/lib/ai-provider-presets.ts`
  - 导出 `AiProvider` 接口：`{ name, baseUrl, models: string[] }`
  - 导出 `COMMON_AI_PROVIDERS` 常量（见下表）
  - `findPresetByName(name: string): AiProvider | undefined`（trim + 大小写敏感匹配 `name` 字段）
  - `getModelOptions(providerName: string, currentModel?: string): string[]`（预设 models + 去重合并 currentModel）

[x] 预设列表（`COMMON_AI_PROVIDERS`，OpenAI 兼容 API；URL/模型随官方文档维护，实现时可微调）

| name | baseUrl | models（示例，第一项为默认） |
|------|---------|------------------------------|
| DeepSeek | https://api.deepseek.com | deepseek-chat, deepseek-reasoner |
| OpenAI | https://api.openai.com/v1 | gpt-4o, gpt-4o-mini, o3-mini |
| OpenRouter | https://openrouter.ai/api/v1 | openai/gpt-4o, deepseek/deepseek-chat, anthropic/claude-3.5-sonnet |
| Anthropic | https://api.anthropic.com/v1 | claude-sonnet-4-20250514, claude-3-5-haiku-20241022 |
| Google Gemini | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.0-flash, gemini-1.5-pro |
| GLM (Zhipu) | https://open.bigmodel.cn/api/paas/v4 | glm-4-plus, glm-4-flash |
| Moonshot (Kimi) | https://api.moonshot.cn/v1 | moonshot-v1-8k, moonshot-v1-32k |
| DashScope (Qwen) | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus, qwen-turbo |
| SiliconFlow | https://api.siliconflow.cn/v1 | deepseek-ai/DeepSeek-V3, Qwen/Qwen2.5-72B-Instruct |
| Groq | https://api.groq.com/openai/v1 | llama-3.3-70b-versatile, mixtral-8x7b-32768 |
| Mistral | https://api.mistral.ai/v1 | mistral-large-latest, mistral-small-latest |
| Together AI | https://api.together.xyz/v1 | meta-llama/Llama-3.3-70B-Instruct-Turbo |
| Ollama | http://localhost:11434/v1 | llama3.2, qwen2.5 |
| Azure OpenAI | https://{resource}.openai.azure.com/openai/deployments/{deployment} | gpt-4o（占位，用户需改 deployment） |
| xAI | https://api.x.ai/v1 | grok-2-latest |
| Doubao (Volcengine) | https://ark.cn-beijing.volces.com/api/v3 | doubao-pro-32k |

说明：Azure 等需用户替换资源的 URL 仍作为**起点模板**；选择预设且 baseURL 为空时填入，用户可自行编辑。

### 5.2 可复用 Combobox 组件

[x] 新增 `apps/ui/src/components/ui/settings/AiProviderNameCombobox.tsx`
[x] 新增 `apps/ui/src/components/ui/settings/AiModelCombobox.tsx`
[x] 新增 `apps/ui/src/components/ui/settings/AiSettingsStringCombobox.tsx`（基于 `@/components/ui/combobox`）
  - `filter={null}` 下拉不筛选；`inputValue` + `onOpenChange` 提交自定义文本
  - 保留 `data-testid`：`ai-provider-name-${index}`、`ai-provider-model-${index}`
[x] `apps/ui/vite.config.ts` React 单例配置（alias + dedupe + optimizeDeps）

### 5.3 集成 AiSettings

[x] 修改 `AiSettings.tsx`：
  - Provider Name → `AiProviderNameCombobox`
  - Model → `AiModelCombobox`，`modelOptions={getModelOptions(provider.name, provider.model)}`
  - `handleProviderNameChange`：`findPresetByName` + 空字段时填入 baseURL/model
  - baseURL / apiKey 仍为 `<Input>`

[x] `addProvider()` 保持 `provider-N` 默认名

### 5.4 测试与验证

[x] `data-testid` 保留于 `ComboboxInput`（E2E `setValue` 兼容，待本地 e2e 跑通确认）
[x] `apps/ui/src/lib/ai-provider-presets.test.ts`（Vitest）

## 6. Backward Compatibility

none

- 持久化格式仍为 `OpenAICompatibleConfig[]`，旧配置加载后 combobox 显示已有 name/model
- 自定义名称不与预设匹配时，行为与当前纯文本输入一致

## 7. Documents

[x] 无需更新用户文档（设置 UI 增强，无 API/配置 schema 变更）

## 8. Post Verification

[x] Unit tests：`pnpm test` — `ai-provider-presets.test.ts` 通过
[ ] E2E：`apps/e2e` 下 `ConfigDialog-AI.e2e.ts` 通过
[x] Typecheck：`pnpm typecheck`（apps/ui）通过

## 9. Confirmed decisions (from Q&A)

| 问题 | 决定 |
|------|------|
| 选择预设时覆盖 baseURL/model | **仅当对应字段为空时**填入预设 |
| apiKey | **保留**用户已输入值 |
| 预设列表 | **扩展常用提供商**（见 §5.1 表），UI 专用，不写入 `packages/core` |
