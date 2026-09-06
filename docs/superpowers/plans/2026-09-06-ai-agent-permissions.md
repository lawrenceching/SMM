# AI Agent Permissions Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "AI Agent" settings category with an `aiAgent.permissions` config (`metadata.write` bypass ACL) persisted to `smm.json`.

**Architecture:** Types live in `packages/types` (shared `UserConfig`); the renderer merges `aiAgent` defaults in `apps/ui/src/api/readUserConfig.ts`; a new `AiAgentSettings` component follows the `GeneralSettings` pattern (local state + Save button); the tab is wired in `config-panel.tsx` with keys in all 4 locales. Enforcement in AI tools / MCP handlers is explicitly out of scope (see spec).

**Tech Stack:** React 18 + TypeScript, vitest + testing-library (jsdom), i18next JSON locales, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-06-ai-agent-permissions-design.md`

---

### Task 1: `aiAgent` config type + renderer defaults

**Files:**
- Modify: `packages/types/types.ts` (insert before `export interface UserConfig` at line 51; add field before interface closing brace at line 156)
- Modify: `apps/ui/src/api/readUserConfig.ts` (defaults at lines 7-29; normalize at lines 32-45)
- Test: `apps/ui/src/api/readUserConfig.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/ui/src/api/readUserConfig.test.ts`, add `AI_AGENT_PERMISSIONS` to the existing type import (line 2) and add two tests inside the existing `describe('normalizeUserConfig', ...)` block (after the test ending at line 50):

```ts
import { AI_AGENT_PERMISSIONS, type UserConfig } from '@smm/types'
```

```ts
  it('fills missing aiAgent with empty permissions', () => {
    const raw: Partial<UserConfig> = { folders: [] }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.aiAgent).toEqual({ permissions: [] })
  })

  it('merges partial aiAgent without dropping other defaults', () => {
    const raw: Partial<UserConfig> = {
      aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
    }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.aiAgent).toEqual({ permissions: ['metadata.write'] })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/ui && pnpm test src/api/readUserConfig.test.ts`
Expected: FAIL — `AI_AGENT_PERMISSIONS` is undefined, so `AI_AGENT_PERMISSIONS.metadataWrite` throws; `normalized.aiAgent` is undefined instead of `{ permissions: [] }`.

- [ ] **Step 3: Add types + defaults + normalize**

In `packages/types/types.ts`, insert immediately **before** `export interface UserConfig {` (line 51):

```ts
/**
 * Permissions that let AI Assistant / MCP clients bypass the
 * corresponding confirmation (permission) check.
 */
export const AI_AGENT_PERMISSIONS = {
  /** Update media metadata (rename folders/files, metadata cache) without confirmation. */
  metadataWrite: "metadata.write",
} as const;

export type AiAgentPermission =
  (typeof AI_AGENT_PERMISSIONS)[keyof typeof AI_AGENT_PERMISSIONS];

export interface AiAgentConfig {
  /**
   * Permissions granted to AI Assistant / MCP clients.
   * Empty or undefined means every write still asks for confirmation.
   */
  permissions?: AiAgentPermission[];
}
```

In the same file, inside `interface UserConfig`, after the `quickjsExecutablePath?: string` field (line 155), add:

```ts
  /**
   * AI Agent settings. Currently only holds permissions that let
   * AI Assistant / MCP clients bypass confirmation checks.
   */
  aiAgent?: AiAgentConfig;
```

In `apps/ui/src/api/readUserConfig.ts`, add `aiAgent: { permissions: [] }` as the last property of `defaultUserConfig` (after `useBundledFfmpegForVideoCaptioner: true,` at line 28) and add a nested merge to `normalizeUserConfig` (same shape as `tmdb`/`tvdb`), before the closing brace of the returned object:

```ts
    aiAgent: {
      ...defaultUserConfig.aiAgent,
      ...(raw.aiAgent ?? {}),
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ui && pnpm test src/api/readUserConfig.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add packages/types/types.ts apps/ui/src/api/readUserConfig.ts apps/ui/src/api/readUserConfig.test.ts
git commit -m "feat: add aiAgent permissions config to user config"
```

---

### Task 2: `AiAgentSettings` component

**Files:**
- Create: `apps/ui/src/components/ui/settings/AiAgentSettings.tsx`
- Test: `apps/ui/src/components/ui/settings/AiAgentSettings.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/ui/src/components/ui/settings/AiAgentSettings.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiAgentSettings } from "./AiAgentSettings";
import { AI_AGENT_PERMISSIONS } from "@smm/types";

const defaultUserConfig = {
  tmdb: {},
  tvdb: {},
  folders: [],
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "",
  aiAgent: { permissions: [] as string[] },
};

const mockSetAndSaveUserConfig = vi.fn();

const mockUseConfig = vi.fn(() => ({
  userConfig: defaultUserConfig,
  setAndSaveUserConfig: mockSetAndSaveUserConfig,
}));

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/utils", () => ({
  nextTraceId: () => "test-trace-id",
}));

describe("AiAgentSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the AI agent settings page", () => {
    render(<AiAgentSettings />);
    expect(screen.getByTestId("ai-agent-settings")).toBeInTheDocument();
  });

  it("checkbox is unchecked when no permissions are granted", () => {
    render(<AiAgentSettings />);
    expect(
      screen.getByTestId("setting-ai-agent-metadata-write"),
    ).not.toBeChecked();
  });

  it("checkbox is checked when metadata.write is granted", () => {
    mockUseConfig.mockReturnValue({
      userConfig: {
        ...defaultUserConfig,
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      },
      setAndSaveUserConfig: mockSetAndSaveUserConfig,
    });
    render(<AiAgentSettings />);
    expect(screen.getByTestId("setting-ai-agent-metadata-write")).toBeChecked();
  });

  it("hides save button until something changes", () => {
    render(<AiAgentSettings />);
    expect(screen.queryByTestId("settings-save-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));

    expect(screen.getByTestId("settings-save-button")).toBeInTheDocument();
  });

  it("saves metadata.write permission when checked and saved", async () => {
    render(<AiAgentSettings />);
    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));
    fireEvent.click(screen.getByTestId("settings-save-button"));

    expect(mockSetAndSaveUserConfig).toHaveBeenCalledTimes(1);
    const [traceId, savedConfig] = mockSetAndSaveUserConfig.mock.calls[0];
    expect(traceId).toContain("AiAgentSettings");
    expect(savedConfig.aiAgent.permissions).toEqual(["metadata.write"]);
  });

  it("saves empty permissions when unchecked and saved", async () => {
    mockUseConfig.mockReturnValue({
      userConfig: {
        ...defaultUserConfig,
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      },
      setAndSaveUserConfig: mockSetAndSaveUserConfig,
    });
    render(<AiAgentSettings />);
    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));
    fireEvent.click(screen.getByTestId("settings-save-button"));

    const [, savedConfig] = mockSetAndSaveUserConfig.mock.calls[0];
    expect(savedConfig.aiAgent.permissions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/ui && pnpm test src/components/ui/settings/AiAgentSettings.test.tsx`
Expected: FAIL — `./AiAgentSettings` does not exist (import error).

- [ ] **Step 3: Implement the component**

Create `apps/ui/src/components/ui/settings/AiAgentSettings.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { AI_AGENT_PERMISSIONS } from "@smm/types"

export function AiAgentSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])

  const initialValues = useMemo(
    () => ({
      metadataWrite:
        userConfig.aiAgent?.permissions?.includes(
          AI_AGENT_PERMISSIONS.metadataWrite,
        ) ?? false,
    }),
    [userConfig],
  )

  const [metadataWrite, setMetadataWrite] = useState(initialValues.metadataWrite)

  // Reset form when userConfig changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMetadataWrite(initialValues.metadataWrite)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialValues])

  const hasChanges = metadataWrite !== initialValues.metadataWrite

  const handleSave = async () => {
    const traceId = `AiAgentSettings-${nextTraceId()}`
    console.log(`[${traceId}] AiAgentSettings: Saving AI agent settings`)
    await setAndSaveUserConfig(traceId, {
      ...userConfig,
      aiAgent: {
        ...userConfig.aiAgent,
        permissions: metadataWrite ? [AI_AGENT_PERMISSIONS.metadataWrite] : [],
      },
    })
  }

  return (
    <div className="space-y-6 p-6 relative" data-testid="ai-agent-settings">
      <div>
        <h2 className="text-lg font-semibold">{t('aiAgent.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('aiAgent.description')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="ai-agent-metadata-write"
            type="checkbox"
            checked={metadataWrite}
            onChange={(e) => setMetadataWrite(e.target.checked)}
            className="h-4 w-4 rounded border-input"
            data-testid="setting-ai-agent-metadata-write"
          />
          <Label htmlFor="ai-agent-metadata-write">{t('aiAgent.metadataWrite')}</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('aiAgent.metadataWriteDescription')}
        </p>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave} data-testid="settings-save-button">
            {t('save', { ns: 'common' })}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ui && pnpm test src/components/ui/settings/AiAgentSettings.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/ui/settings/AiAgentSettings.tsx apps/ui/src/components/ui/settings/AiAgentSettings.test.tsx
git commit -m "feat(ui): add AiAgentSettings component"
```

---

### Task 3: Panel wiring + locales

**Files:**
- Modify: `apps/ui/src/components/ui/config-panel.tsx` (lines 2-3, 11, 24-28, 66-79)
- Modify: `apps/ui/public/locales/en/settings.json`
- Modify: `apps/ui/public/locales/zh-CN/settings.json`
- Modify: `apps/ui/public/locales/zh-HK/settings.json`
- Modify: `apps/ui/public/locales/zh-TW/settings.json`

No unit tests — no test infra exists for `config-panel.tsx` or locale JSON. Verified by typecheck + full suite (Task 4).

- [ ] **Step 1: Wire the tab in `config-panel.tsx`**

Add `Sparkles` to the lucide-react import (line 2) and the component import (line 4 area):

```tsx
import { Settings, Bot, MessageSquare, Box, Database, Sparkles } from "lucide-react"
import { AiAgentSettings } from "./settings/AiAgentSettings"
```

Extend the `SettingsTab` union (line 11) — insert `"ai-agent"` after `"ai"`:

```tsx
export type SettingsTab = "general" | "ai" | "ai-agent" | "external-apps" | "media-databases" | "rename-rules" | "feedback"
```

In `menuItems` (line 21-29), insert between the `"ai"` entry and the `"media-databases"` entry:

```tsx
    { id: "ai-agent", label: t('sidebar.aiAgent'), icon: <Sparkles className="h-4 w-4" /> },
```

In `renderContent` (lines 65-80), add a case after `case "ai":`:

```tsx
      case "ai-agent":
        return <AiAgentSettings />
```

- [ ] **Step 2: Add en locale keys**

In `apps/ui/public/locales/en/settings.json`, insert an `"aiAgent"` section after the `"ai"` section (after line 92, including a comma), and `"aiAgent"` in `sidebar` after `"ai"`:

```json
  "aiAgent": {
    "title": "AI Agent",
    "description": "Configure permissions granted to AI Assistant and MCP clients",
    "metadataWrite": "Allow metadata writes without confirmation",
    "metadataWriteDescription": "AI Assistant and MCP clients can update media metadata (e.g. rename folders/files) without asking for confirmation each time."
  },
```

```json
    "aiAgent": "AI Agent"
```

(In `sidebar`, add a comma after `"ai": "AI"` and place `"aiAgent"` before `"mediaDatabases"`.)

- [ ] **Step 3: Add zh-CN locale keys**

In `apps/ui/public/locales/zh-CN/settings.json`, same placement:

```json
  "aiAgent": {
    "title": "AI 智能体",
    "description": "配置授予 AI 助手和 MCP 客户端的权限",
    "metadataWrite": "允许无需确认即写入元数据",
    "metadataWriteDescription": "AI 助手和 MCP 客户端将可以直接更新媒体元数据（例如重命名文件夹/文件），无需每次确认。"
  },
```

```json
    "aiAgent": "AI 智能体"
```

- [ ] **Step 4: Add zh-HK and zh-TW locale keys**

In both `apps/ui/public/locales/zh-HK/settings.json` and `apps/ui/public/locales/zh-TW/settings.json`, same placement:

```json
  "aiAgent": {
    "title": "AI 代理",
    "description": "設定授予 AI 助理與 MCP 用戶端的權限",
    "metadataWrite": "允許無需確認即寫入元資料",
    "metadataWriteDescription": "AI 助理與 MCP 用戶端將可以直接更新媒體元資料（例如重新命名資料夾/檔案），無需每次確認。"
  },
```

```json
    "aiAgent": "AI 代理"
```

- [ ] **Step 5: Validate JSON and typecheck**

Run: `node -e "['en','zh-CN','zh-HK','zh-TW'].forEach(l => require('./apps/ui/public/locales/' + l + '/settings.json'))" && cd apps/ui && pnpm typecheck`
Expected: no output errors from node; `tsc --noEmit` exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/ui/config-panel.tsx apps/ui/public/locales/en/settings.json apps/ui/public/locales/zh-CN/settings.json apps/ui/public/locales/zh-HK/settings.json apps/ui/public/locales/zh-TW/settings.json
git commit -m "feat(ui): add AI Agent tab and locales"
```

---

### Task 4: Full verification + spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-ai-agent-permissions-design.md` (status banner)

- [ ] **Step 1: Run the full apps/ui test suite**

Run: `cd apps/ui && pnpm test`
Expected: PASS — no regressions in `GeneralSettings.test.tsx`, `readUserConfig.test.ts`, or any other suite.

- [ ] **Step 2: Lint**

Run: `cd apps/ui && pnpm lint`
Expected: no new errors introduced by the changed/created files.

- [ ] **Step 3: Manual browser check**

Run `cd apps/ui && pnpm dev`, open the app, go to Settings:
1. Sidebar shows "AI Agent" between "AI" and "Media Databases"
2. AI Agent tab shows the checkbox, unchecked by default
3. Toggle it → Save button appears bottom-right → click Save
4. Verify `smm.json` in the user data dir now contains `"aiAgent": { "permissions": ["metadata.write"] }`
5. Reopen settings → checkbox still checked; uncheck + Save → smm.json has `"permissions": []`

(If the standalone renderer dev server cannot reach a backend in this environment, note that explicitly in the task report instead of claiming the check passed.)

- [ ] **Step 4: Flip the spec status banner**

In `docs/superpowers/specs/2026-09-06-ai-agent-permissions-design.md`, replace:

```markdown
> **Status:** Pending implementation.
```

with:

```markdown
> **Status:** Implemented (2026-09-06). Commit range: `<first-task-sha>`..`<last-commit-sha>`.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-ai-agent-permissions-design.md
git commit -m "docs: mark ai-agent permissions design implemented"
```
