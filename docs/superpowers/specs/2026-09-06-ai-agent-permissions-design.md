# AI Agent Settings — Permissions Config

This design document describes the high level design of a feature.
The design document is golden source and referenced by one or more features.

> **Status:** Pending implementation.

## 1. Background

AI Assistant tools and MCP clients currently ask for user confirmation before every write operation (rename folder, rename episode file, batch rename, ...). Users who want hands-off automation have no way to pre-authorize these writes.

This feature adds a new **"AI Agent"** settings category with a **`permissions`** config: an access control list that lets the user allow AI Assistant / MCP clients to bypass permission (confirmation) checks. At this stage only one permission is supported: **`metadata.write`**.

**Scope for this feature (locked):**

- **In scope:** new `AiAgentSettings` UI component; new "AI Agent" tab in the config panel; read/write support for `aiAgent.permissions` in user config (`smm.json`); i18n for all 4 locales.
- **Out of scope:** enforcement (skipping confirmation prompts in AI tools / MCP handlers); server-side (`core-routes` / CLI / `apps/core`) normalization of `aiAgent`; any permission beyond `metadata.write`.

**Decisions (locked):**

- Config shape: nested `aiAgent: { permissions: AiAgentPermission[] }` on `UserConfig` (user chose nested over flat `permissions`).
- UI form: a single checkbox toggling the one supported permission; a permission list table is deferred until a second permission exists.
- Approach: renderer-only plumbing (Approach A). Server-side defaults/normalization and a shared `hasAiAgentPermission()` helper are deferred to the enforcement feature.
- Default is `permissions: []` — no bypass unless the user explicitly grants it (safe default).

## 2. Architecture

### 2.1 Project Level Architecture

Primary work is in `apps/ui` and `packages/types`. No new API routes; the existing renderer read/write path persists the field as JSON.

| Package / App | Change |
|---------------|--------|
| `packages/types` | Add `AI_AGENT_PERMISSIONS` constant, `AiAgentPermission` type, `AiAgentConfig` interface, `aiAgent?: AiAgentConfig` on `UserConfig` |
| `apps/ui` | `AiAgentSettings` component, "AI Agent" tab in `config-panel.tsx`, `aiAgent` defaults in `normalizeUserConfig`, locales |

### 2.2 App Level Architecture

#### Config field

```ts
// packages/types/types.ts
export const AI_AGENT_PERMISSIONS = {
  metadataWrite: "metadata.write",
} as const;
export type AiAgentPermission =
  (typeof AI_AGENT_PERMISSIONS)[keyof typeof AI_AGENT_PERMISSIONS];

export interface AiAgentConfig {
  /** Permissions granted to AI Assistant / MCP clients (bypass confirmation). */
  permissions?: AiAgentPermission[];
}

// UserConfig gains:
aiAgent?: AiAgentConfig;
```

The `"metadata.write"` literal exists only in `AI_AGENT_PERMISSIONS`.

#### Renderer read path (`apps/ui/src/api/readUserConfig.ts`)

- `defaultUserConfig` gains `aiAgent: { permissions: [] }`.
- `normalizeUserConfig` adds a nested merge, same shape as `tmdb`/`tvdb`:

```ts
aiAgent: {
  ...defaultUserConfig.aiAgent,
  ...(raw.aiAgent ?? {}),
},
```

- Write path needs no changes — `setAndSaveUserConfig` persists the whole object to `smm.json`.

#### UI — `AiAgentSettings` (new, `apps/ui/src/components/ui/settings/`)

Follows the `GeneralSettings` pattern:

- `useConfig()` for `userConfig` + `setAndSaveUserConfig`; initial-values memo synced via effect on config reload.
- Plain `<input type="checkbox">` + `Label` + description paragraph (matches the existing telemetry / MCP-server checkboxes; the shadcn `Checkbox` component is not used by settings today).
- Checked state derives from `userConfig.aiAgent?.permissions?.includes(AI_AGENT_PERMISSIONS.metadataWrite) ?? false`.
- On save: `aiAgent.permissions = checked ? ["metadata.write"] : []` (whole-array replace — only one permission exists today).
- Save button appears only when `hasChanges`, same as `GeneralSettings`.
- `data-testid` conventions: `ai-agent-settings` (root), `setting-ai-agent-metadata-write` (checkbox), `settings-save-button` (save).

#### Panel wiring (`apps/ui/src/components/ui/config-panel.tsx`)

- `SettingsTab` union gains `"ai-agent"`.
- Menu item added between "ai" and "media-databases" with the `Sparkles` icon (`Bot` is taken by AI settings); label from `t('sidebar.aiAgent')`.
- `renderContent` gains a `"ai-agent"` case returning `<AiAgentSettings />`.

#### i18n (`apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/settings.json`)

| Key | en | zh-CN | zh-HK / zh-TW |
|-----|----|-----------------------|---------------|
| `sidebar.aiAgent` | `AI Agent` | `AI 智能体` | `AI 代理` |
| `aiAgent.title` | `AI Agent` | `AI 智能体` | `AI 代理` |
| `aiAgent.description` | `Configure permissions granted to AI Assistant and MCP clients` | `配置授予 AI 助手和 MCP 客户端的权限` | `設定授予 AI 助理與 MCP 用戶端的權限` |
| `aiAgent.metadataWrite` | `Allow metadata writes without confirmation` | `允许无需确认即写入元数据` | zh-HK：`允許無需確認即寫入元資料`；zh-TW：`允許無需確認即寫入中繼資料` |
| `aiAgent.metadataWriteDescription` | `AI Assistant and MCP clients can update media metadata (e.g. rename folders/files) without asking for confirmation each time.` | `AI 助手和 MCP 客户端将可以直接更新媒体元数据（例如重命名文件夹/文件），无需每次确认。` | zh-HK：`...更新媒體元資料...`；zh-TW：`AI 助理與 MCP 用戶端將可以直接更新媒體中繼資料（例如重新命名資料夾/檔案），無需每次確認。` |

Save button reuses the existing common-namespace key: `t('save', { ns: 'common' })` (same as `GeneralSettings`).

#### Tests

- `normalizeUserConfig`: config without `aiAgent` gets `{ permissions: [] }`; partial `aiAgent` merges over defaults.
- New `AiAgentSettings.test.tsx` (following `GeneralSettings.test.tsx`): checkbox reflects persisted config; toggling reveals Save; saving persists `aiAgent.permissions`; no Save button initially.
