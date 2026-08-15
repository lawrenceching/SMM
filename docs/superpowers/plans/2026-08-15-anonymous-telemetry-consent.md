# Anonymous Telemetry Consent Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On first launch (when `anonymousTelemetryConsent` is unset), show a dismissible consent dialog; persist agree/disagree on `UserConfig`; allow changing the choice later in General Settings. No actual telemetry upload.

**Architecture:** Optional boolean on shared `UserConfig`. A small `AnonymousTelemetryConsentGate` mounts next to `AppInitializer`, opens `AnonymousTelemetryConsentDialog` when the field is `undefined`, and persists via `setAndSaveUserConfig`. Dismiss (mask/Esc) equals disagree. General Settings adds a checkbox following the existing form + Save pattern.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, react-i18next, shadcn Dialog, existing `useConfig` / `UserConfig`.

**Spec:** `docs/superpowers/specs/2026-08-15-anonymous-telemetry-consent-design.md`

## Global Constraints

- Do **not** implement telemetry collection or network upload in any task.
- Do **not** set `anonymousTelemetryConsent` on any `DEFAULT_USER_CONFIG` / `defaultUserConfig` (must stay `undefined` so first launch and upgrades prompt once).
- Dismiss (overlay / Esc / close) MUST persist `false`, same as Disagree.
- Agree must not also persist `false` when the dialog closes after a successful agree.
- Settings toggle uses General Settings local form state + Save (not immediate write).
- i18n for `en`, `zh-CN`, `zh-HK`, `zh-TW`.

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/core/types.ts` | Add `anonymousTelemetryConsent?: boolean` on `UserConfig` |
| `apps/ui/src/lib/anonymousTelemetryConsent.ts` | Pure `shouldShowAnonymousTelemetryConsent` helper |
| `apps/ui/src/lib/anonymousTelemetryConsent.test.ts` | Helper unit tests |
| `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.tsx` | Consent dialog UI |
| `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx` | Dialog interaction tests |
| `apps/ui/src/components/dialogs/index.ts` | Re-export dialog |
| `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.tsx` | Open dialog when unset; persist choice |
| `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.test.tsx` | Gate open/persist tests |
| `apps/ui/src/main.tsx` | Mount gate under `DialogProvider` |
| `apps/ui/src/components/ui/settings/GeneralSettings.tsx` | Checkbox + save field |
| `apps/ui/src/components/ui/settings/GeneralSettings.test.tsx` | Assert checkbox present / save includes field |
| `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/components.json` | Dialog copy |
| `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/settings.json` | Settings checkbox copy |
| `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts` | Locale regression |

Defaults in `apps/ui/src/api/readUserConfig.ts`, `apps/cli/src/utils/config.ts`, and `packages/core-routes/src/userConfig.ts` are **not** modified (field stays omitted).

---

### Task 1: Add `UserConfig.anonymousTelemetryConsent`

**Files:**
- Modify: `packages/core/types.ts` (near other optional preference fields, e.g. after `mcpPort`)
- Test: `apps/ui/src/lib/anonymousTelemetryConsent.test.ts` (created in Task 2; this task only adds the type — verify with typecheck if desired)

**Interfaces:**
- Produces: `UserConfig.anonymousTelemetryConsent?: boolean`

- [ ] **Step 1: Add the optional field to `UserConfig`**

In `packages/core/types.ts`, after the `mcpPort` field block, add:

```ts
  /**
   * Whether the user consented to anonymous telemetry / usage information.
   * - `undefined`: never asked — UI should show the consent dialog once
   * - `true`: agreed
   * - `false`: declined (including dismiss)
   *
   * Must remain unset in default configs so first launch and upgrades prompt.
   */
  anonymousTelemetryConsent?: boolean
```

- [ ] **Step 2: Confirm defaults omit the field**

Open and confirm these objects do **not** set `anonymousTelemetryConsent`:

- `apps/ui/src/api/readUserConfig.ts` → `defaultUserConfig`
- `apps/cli/src/utils/config.ts` → `DEFAULT_USER_CONFIG`
- `packages/core-routes/src/userConfig.ts` → `DEFAULT_USER_CONFIG`

Do not add the property to them.

- [ ] **Step 3: Commit**

```bash
git add packages/core/types.ts
git commit -m "$(cat <<'EOF'
feat(core): add anonymousTelemetryConsent to UserConfig

EOF
)"
```

---

### Task 2: Pure helper + i18n keys

**Files:**
- Create: `apps/ui/src/lib/anonymousTelemetryConsent.ts`
- Create: `apps/ui/src/lib/anonymousTelemetryConsent.test.ts`
- Create: `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts`
- Modify: `apps/ui/public/locales/en/components.json`
- Modify: `apps/ui/public/locales/zh-CN/components.json`
- Modify: `apps/ui/public/locales/zh-HK/components.json`
- Modify: `apps/ui/public/locales/zh-TW/components.json`
- Modify: `apps/ui/public/locales/en/settings.json`
- Modify: `apps/ui/public/locales/zh-CN/settings.json`
- Modify: `apps/ui/public/locales/zh-HK/settings.json`
- Modify: `apps/ui/public/locales/zh-TW/settings.json`

**Interfaces:**
- Consumes: `UserConfig.anonymousTelemetryConsent`
- Produces: `shouldShowAnonymousTelemetryConsent(consent: boolean | undefined): boolean`

- [ ] **Step 1: Write the failing helper test**

Create `apps/ui/src/lib/anonymousTelemetryConsent.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { shouldShowAnonymousTelemetryConsent } from "./anonymousTelemetryConsent"

describe("shouldShowAnonymousTelemetryConsent", () => {
  it("returns true when consent is undefined", () => {
    expect(shouldShowAnonymousTelemetryConsent(undefined)).toBe(true)
  })

  it("returns false when consent is true", () => {
    expect(shouldShowAnonymousTelemetryConsent(true)).toBe(false)
  })

  it("returns false when consent is false", () => {
    expect(shouldShowAnonymousTelemetryConsent(false)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ui && pnpm exec vitest run src/lib/anonymousTelemetryConsent.test.ts`

Expected: FAIL (module / export not found)

- [ ] **Step 3: Implement the helper**

Create `apps/ui/src/lib/anonymousTelemetryConsent.ts`:

```ts
/**
 * Show the first-run consent dialog only when the user has never answered.
 */
export function shouldShowAnonymousTelemetryConsent(
  consent: boolean | undefined,
): boolean {
  return consent === undefined
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `cd apps/ui && pnpm exec vitest run src/lib/anonymousTelemetryConsent.test.ts`

Expected: PASS

- [ ] **Step 5: Write the failing locale catalog test**

Create `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import enComponents from "../../../public/locales/en/components.json"
import zhCNComponents from "../../../public/locales/zh-CN/components.json"
import zhHKComponents from "../../../public/locales/zh-HK/components.json"
import zhTWComponents from "../../../public/locales/zh-TW/components.json"
import enSettings from "../../../public/locales/en/settings.json"
import zhCNSettings from "../../../public/locales/zh-CN/settings.json"
import zhHKSettings from "../../../public/locales/zh-HK/settings.json"
import zhTWSettings from "../../../public/locales/zh-TW/settings.json"

interface ConsentDialogCatalog {
  anonymousTelemetryConsent: {
    title: string
    description: string
    agree: string
    disagree: string
  }
}

interface SettingsCatalog {
  general: {
    anonymousTelemetryConsent: string
    anonymousTelemetryConsentDescription: string
  }
}

const componentLocales: { name: string; data: ConsentDialogCatalog }[] = [
  { name: "en", data: enComponents as unknown as ConsentDialogCatalog },
  { name: "zh-CN", data: zhCNComponents as unknown as ConsentDialogCatalog },
  { name: "zh-HK", data: zhHKComponents as unknown as ConsentDialogCatalog },
  { name: "zh-TW", data: zhTWComponents as unknown as ConsentDialogCatalog },
]

const settingsLocales: { name: string; data: SettingsCatalog }[] = [
  { name: "en", data: enSettings as unknown as SettingsCatalog },
  { name: "zh-CN", data: zhCNSettings as unknown as SettingsCatalog },
  { name: "zh-HK", data: zhHKSettings as unknown as SettingsCatalog },
  { name: "zh-TW", data: zhTWSettings as unknown as SettingsCatalog },
]

describe("anonymous telemetry consent locale catalog", () => {
  for (const { name, data } of componentLocales) {
    describe(`components ${name}`, () => {
      it("defines anonymousTelemetryConsent dialog strings", () => {
        const block = data.anonymousTelemetryConsent
        expect(typeof block.title).toBe("string")
        expect(block.title.length).toBeGreaterThan(0)
        expect(typeof block.description).toBe("string")
        expect(block.description.length).toBeGreaterThan(0)
        expect(typeof block.agree).toBe("string")
        expect(block.agree.length).toBeGreaterThan(0)
        expect(typeof block.disagree).toBe("string")
        expect(block.disagree.length).toBeGreaterThan(0)
      })
    })
  }

  for (const { name, data } of settingsLocales) {
    describe(`settings ${name}`, () => {
      it("defines general.anonymousTelemetryConsent strings", () => {
        expect(typeof data.general.anonymousTelemetryConsent).toBe("string")
        expect(data.general.anonymousTelemetryConsent.length).toBeGreaterThan(0)
        expect(typeof data.general.anonymousTelemetryConsentDescription).toBe("string")
        expect(data.general.anonymousTelemetryConsentDescription.length).toBeGreaterThan(0)
      })
    })
  }
})
```

- [ ] **Step 6: Run locale test to verify it fails**

Run: `cd apps/ui && pnpm exec vitest run src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts`

Expected: FAIL (missing keys)

- [ ] **Step 7: Add locale strings**

Add to each `apps/ui/public/locales/*/components.json` (top-level key alongside other feature blocks):

**en:**

```json
  "anonymousTelemetryConsent": {
    "title": "Help improve SMM",
    "description": "We would like to collect anonymous usage information such as app version, operating system, and crash or usage statistics. This does not include personal identity or the contents of your media files.",
    "agree": "Agree",
    "disagree": "Disagree"
  }
```

**zh-CN:**

```json
  "anonymousTelemetryConsent": {
    "title": "帮助改进 SMM",
    "description": "我们希望收集匿名使用信息，例如应用版本、操作系统，以及崩溃与使用统计。不会包含个人身份信息，也不会包含您的媒体文件内容。",
    "agree": "同意",
    "disagree": "不同意"
  }
```

**zh-HK:**

```json
  "anonymousTelemetryConsent": {
    "title": "協助改進 SMM",
    "description": "我們希望收集匿名使用資訊，例如應用程式版本、作業系統，以及當機與使用統計。不會包含個人身分資訊，亦不會包含您的媒體檔案內容。",
    "agree": "同意",
    "disagree": "不同意"
  }
```

**zh-TW:**

```json
  "anonymousTelemetryConsent": {
    "title": "協助改進 SMM",
    "description": "我們希望收集匿名使用資訊，例如應用程式版本、作業系統，以及當機與使用統計。不會包含個人身分資訊，也不會包含您的媒體檔案內容。",
    "agree": "同意",
    "disagree": "不同意"
  }
```

Add to each `apps/ui/public/locales/*/settings.json` under `"general"`:

**en:**

```json
    "anonymousTelemetryConsent": "Allow anonymous usage information",
    "anonymousTelemetryConsentDescription": "Share anonymous app version, OS, and usage/crash statistics. Never includes personal identity or media file contents."
```

**zh-CN:**

```json
    "anonymousTelemetryConsent": "允许收集匿名使用信息",
    "anonymousTelemetryConsentDescription": "分享匿名的应用版本、操作系统以及使用/崩溃统计。不会包含个人身份或媒体文件内容。"
```

**zh-HK:**

```json
    "anonymousTelemetryConsent": "允許收集匿名使用資訊",
    "anonymousTelemetryConsentDescription": "分享匿名的應用程式版本、作業系統以及使用/當機統計。不會包含個人身分或媒體檔案內容。"
```

**zh-TW:**

```json
    "anonymousTelemetryConsent": "允許收集匿名使用資訊",
    "anonymousTelemetryConsentDescription": "分享匿名的應用程式版本、作業系統以及使用/當機統計。不會包含個人身分或媒體檔案內容。"
```

- [ ] **Step 8: Run locale test to verify it passes**

Run: `cd apps/ui && pnpm exec vitest run src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts src/lib/anonymousTelemetryConsent.test.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/ui/src/lib/anonymousTelemetryConsent.ts \
  apps/ui/src/lib/anonymousTelemetryConsent.test.ts \
  apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts \
  apps/ui/public/locales/en/components.json \
  apps/ui/public/locales/zh-CN/components.json \
  apps/ui/public/locales/zh-HK/components.json \
  apps/ui/public/locales/zh-TW/components.json \
  apps/ui/public/locales/en/settings.json \
  apps/ui/public/locales/zh-CN/settings.json \
  apps/ui/public/locales/zh-HK/settings.json \
  apps/ui/public/locales/zh-TW/settings.json
git commit -m "$(cat <<'EOF'
feat(ui): add consent helper and i18n for anonymous telemetry

EOF
)"
```

---

### Task 3: Consent dialog component

**Files:**
- Create: `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.tsx`
- Create: `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx`
- Modify: `apps/ui/src/components/dialogs/index.ts`

**Interfaces:**
- Consumes: i18n keys `anonymousTelemetryConsent.*` from `components` namespace
- Produces:

```ts
export interface AnonymousTelemetryConsentDialogProps {
  isOpen: boolean
  onAgree: () => void
  onDisagree: () => void
}
```

- [ ] **Step 1: Write the failing dialog tests**

Create `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AnonymousTelemetryConsentDialog } from "./AnonymousTelemetryConsentDialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe("AnonymousTelemetryConsentDialog", () => {
  const onAgree = vi.fn()
  const onDisagree = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders title and actions when open", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    expect(screen.getByTestId("anonymous-telemetry-consent-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("anonymous-telemetry-consent-agree")).toBeInTheDocument()
    expect(screen.getByTestId("anonymous-telemetry-consent-disagree")).toBeInTheDocument()
  })

  it("calls onAgree when Agree is clicked", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-agree"))
    expect(onAgree).toHaveBeenCalledTimes(1)
    expect(onDisagree).not.toHaveBeenCalled()
  })

  it("calls onDisagree when Disagree is clicked", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-disagree"))
    expect(onDisagree).toHaveBeenCalledTimes(1)
    expect(onAgree).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run dialog tests to verify they fail**

Run: `cd apps/ui && pnpm exec vitest run src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx`

Expected: FAIL (component missing)

- [ ] **Step 3: Implement the dialog**

Create `apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.tsx`:

```tsx
import { useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

export interface AnonymousTelemetryConsentDialogProps {
  isOpen: boolean
  onAgree: () => void
  onDisagree: () => void
}

/**
 * First-run consent for anonymous usage information.
 * Dismiss (overlay / Esc / close) is treated as disagree.
 * Agree uses a ref guard so closing after agree does not also fire disagree.
 */
export function AnonymousTelemetryConsentDialog({
  isOpen,
  onAgree,
  onDisagree,
}: AnonymousTelemetryConsentDialogProps) {
  const { t } = useTranslation("components", {
    keyPrefix: "anonymousTelemetryConsent",
  })
  const decidedRef = useRef(false)

  const handleAgree = () => {
    decidedRef.current = true
    onAgree()
  }

  const handleDisagree = () => {
    decidedRef.current = true
    onDisagree()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !decidedRef.current) {
          onDisagree()
        }
        if (open) {
          decidedRef.current = false
        }
      }}
    >
      <DialogContent
        className="max-w-lg"
        data-testid="anonymous-telemetry-consent-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="anonymous-telemetry-consent-disagree"
            onClick={handleDisagree}
          >
            {t("disagree")}
          </Button>
          <Button
            type="button"
            data-testid="anonymous-telemetry-consent-agree"
            onClick={handleAgree}
          >
            {t("agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Export from `apps/ui/src/components/dialogs/index.ts`:

```ts
export { AnonymousTelemetryConsentDialog } from "./AnonymousTelemetryConsentDialog"
export type { AnonymousTelemetryConsentDialogProps } from "./AnonymousTelemetryConsentDialog"
```

- [ ] **Step 4: Run dialog tests to verify they pass**

Run: `cd apps/ui && pnpm exec vitest run src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.tsx \
  apps/ui/src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx \
  apps/ui/src/components/dialogs/index.ts
git commit -m "$(cat <<'EOF'
feat(ui): add AnonymousTelemetryConsentDialog

EOF
)"
```

---

### Task 4: Consent gate + mount in `main.tsx`

**Files:**
- Create: `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.tsx`
- Create: `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.test.tsx`
- Modify: `apps/ui/src/main.tsx`

**Interfaces:**
- Consumes: `useConfig()` (`userConfig`, `isUserConfigLoaded`, `isLoading`, `setAndSaveUserConfig`), `shouldShowAnonymousTelemetryConsent`, `AnonymousTelemetryConsentDialog`
- Produces: `AnonymousTelemetryConsentGate` React component (renders dialog; returns null otherwise)

- [ ] **Step 1: Write the failing gate tests**

Create `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AnonymousTelemetryConsentGate } from "./AnonymousTelemetryConsentGate"

const setAndSaveUserConfig = vi.fn(async () => {})

const mockUseConfig = vi.fn()

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe("AnonymousTelemetryConsentGate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not open dialog while userConfig is loading", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [] },
      isLoading: true,
      isUserConfigLoaded: false,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.queryByTestId("anonymous-telemetry-consent-dialog")).not.toBeInTheDocument()
  })

  it("opens dialog when consent is undefined after load", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [], anonymousTelemetryConsent: undefined },
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.getByTestId("anonymous-telemetry-consent-dialog")).toBeInTheDocument()
  })

  it("does not open dialog when consent is already true", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [], anonymousTelemetryConsent: true },
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.queryByTestId("anonymous-telemetry-consent-dialog")).not.toBeInTheDocument()
  })

  it("persists true on Agree", async () => {
    const userConfig = { folders: [], anonymousTelemetryConsent: undefined as boolean | undefined }
    mockUseConfig.mockReturnValue({
      userConfig,
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-agree"))
    await waitFor(() => {
      expect(setAndSaveUserConfig).toHaveBeenCalled()
    })
    const [, saved] = setAndSaveUserConfig.mock.calls[0]!
    expect(saved.anonymousTelemetryConsent).toBe(true)
  })

  it("persists false on Disagree", async () => {
    const userConfig = { folders: [], anonymousTelemetryConsent: undefined as boolean | undefined }
    mockUseConfig.mockReturnValue({
      userConfig,
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-disagree"))
    await waitFor(() => {
      expect(setAndSaveUserConfig).toHaveBeenCalled()
    })
    const [, saved] = setAndSaveUserConfig.mock.calls[0]!
    expect(saved.anonymousTelemetryConsent).toBe(false)
  })
})
```

- [ ] **Step 2: Run gate tests to verify they fail**

Run: `cd apps/ui && pnpm exec vitest run src/components/initialization/AnonymousTelemetryConsentGate.test.tsx`

Expected: FAIL (component missing)

- [ ] **Step 3: Implement the gate**

Create `apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import { shouldShowAnonymousTelemetryConsent } from "@/lib/anonymousTelemetryConsent"
import { AnonymousTelemetryConsentDialog } from "@/components/dialogs/AnonymousTelemetryConsentDialog"

/**
 * Shows the anonymous telemetry consent dialog once when
 * `userConfig.anonymousTelemetryConsent` is still undefined.
 */
export function AnonymousTelemetryConsentGate() {
  const {
    userConfig,
    isLoading,
    isUserConfigLoaded,
    setAndSaveUserConfig,
  } = useConfig()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isLoading || !isUserConfigLoaded) return
    if (shouldShowAnonymousTelemetryConsent(userConfig.anonymousTelemetryConsent)) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [
    isLoading,
    isUserConfigLoaded,
    userConfig.anonymousTelemetryConsent,
  ])

  const persist = useCallback(
    async (value: boolean) => {
      const previous = userConfig.anonymousTelemetryConsent
      const next = { ...userConfig, anonymousTelemetryConsent: value }
      const traceId = `AnonymousTelemetryConsent-${nextTraceId()}`
      setIsOpen(false)
      try {
        await setAndSaveUserConfig(traceId, next)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message)
        // Re-open if still unset after failure so the user can retry
        if (previous === undefined) {
          setIsOpen(true)
        }
      }
    },
    [setAndSaveUserConfig, userConfig],
  )

  const onAgree = useCallback(() => {
    void persist(true)
  }, [persist])

  const onDisagree = useCallback(() => {
    void persist(false)
  }, [persist])

  return (
    <AnonymousTelemetryConsentDialog
      isOpen={isOpen}
      onAgree={onAgree}
      onDisagree={onDisagree}
    />
  )
}
```

- [ ] **Step 4: Mount the gate in `main.tsx`**

Inside the `DialogProvider` tree, next to `AppInitializer`:

```tsx
import { AnonymousTelemetryConsentGate } from '@/components/initialization/AnonymousTelemetryConsentGate'
```

```tsx
              <DialogProvider>
                <AppLanguageSync />
                <AppInitializer />
                <AnonymousTelemetryConsentGate />
                <DragDropReceiver>
```

- [ ] **Step 5: Run gate tests to verify they pass**

Run: `cd apps/ui && pnpm exec vitest run src/components/initialization/AnonymousTelemetryConsentGate.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.tsx \
  apps/ui/src/components/initialization/AnonymousTelemetryConsentGate.test.tsx \
  apps/ui/src/main.tsx
git commit -m "$(cat <<'EOF'
feat(ui): show anonymous telemetry consent on first launch

EOF
)"
```

---

### Task 5: General Settings checkbox

**Files:**
- Modify: `apps/ui/src/components/ui/settings/GeneralSettings.tsx`
- Modify: `apps/ui/src/components/ui/settings/GeneralSettings.test.tsx`

**Interfaces:**
- Consumes: `userConfig.anonymousTelemetryConsent`, settings i18n keys `general.anonymousTelemetryConsent*`
- Produces: form field saved as `boolean` (`true`/`false`); checkbox unchecked when `undefined` or `false`

- [ ] **Step 1: Extend the failing / existing GeneralSettings tests**

Add to `apps/ui/src/components/ui/settings/GeneralSettings.test.tsx`:

```ts
  it("renders anonymous telemetry consent checkbox", () => {
    render(<GeneralSettings />);
    expect(
      screen.getByTestId("setting-anonymous-telemetry-consent"),
    ).toBeInTheDocument();
  });

  it("checkbox is unchecked when consent is undefined", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { ...defaultUserConfig, anonymousTelemetryConsent: undefined },
      setAndSaveUserConfig: vi.fn(),
    });
    render(<GeneralSettings />);
    expect(
      screen.getByTestId("setting-anonymous-telemetry-consent"),
    ).not.toBeChecked();
  });

  it("checkbox is checked when consent is true", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { ...defaultUserConfig, anonymousTelemetryConsent: true },
      setAndSaveUserConfig: vi.fn(),
    });
    render(<GeneralSettings />);
    expect(
      screen.getByTestId("setting-anonymous-telemetry-consent"),
    ).toBeChecked();
  });
```

- [ ] **Step 2: Run GeneralSettings tests to verify new ones fail**

Run: `cd apps/ui && pnpm exec vitest run src/components/ui/settings/GeneralSettings.test.tsx`

Expected: FAIL on new assertions (testid missing)

- [ ] **Step 3: Wire the checkbox into GeneralSettings**

Follow the MCP checkbox pattern:

1. Extend `initialValues` with:
   `anonymousTelemetryConsent: userConfig.anonymousTelemetryConsent ?? false`
2. Add state:
   `const [anonymousTelemetryConsent, setAnonymousTelemetryConsent] = useState(initialValues.anonymousTelemetryConsent)`
3. Reset it in the `useEffect` that syncs from `initialValues`
4. Include it in `hasChanges`
5. In `handleSave`, write:
   `anonymousTelemetryConsent` onto `updatedConfig` (boolean `true`/`false`, never leave `undefined` after an explicit save from Settings)
6. UI block (place above the MCP section border, or in the same bordered section before MCP):

```tsx
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="anonymous-telemetry-consent"
                type="checkbox"
                checked={anonymousTelemetryConsent}
                onChange={(e) => setAnonymousTelemetryConsent(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                data-testid="setting-anonymous-telemetry-consent"
              />
              <Label htmlFor="anonymous-telemetry-consent">
                {t("general.anonymousTelemetryConsent")}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("general.anonymousTelemetryConsentDescription")}
            </p>
          </div>
        </div>
```

Keep the existing MCP block as its own bordered section after this (or merge carefully without breaking MCP testids).

- [ ] **Step 4: Run GeneralSettings tests to verify they pass**

Run: `cd apps/ui && pnpm exec vitest run src/components/ui/settings/GeneralSettings.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/ui/settings/GeneralSettings.tsx \
  apps/ui/src/components/ui/settings/GeneralSettings.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add anonymous telemetry toggle in General Settings

EOF
)"
```

---

### Task 6: Manual verification (exploration phase)

No code changes required unless bugs are found.

- [ ] **Step 1: Fresh profile**

1. Point `USER_DATA_DIR` at an empty temp folder (or delete `anonymousTelemetryConsent` from existing `smm.json`).
2. Start `pnpm dev` (or Electron).
3. Confirm consent dialog appears after UI loads.
4. Click **Agree** → restart → dialog must **not** reappear; `smm.json` has `"anonymousTelemetryConsent": true`.

- [ ] **Step 2: Disagree / dismiss**

1. Reset field to unset again.
2. Restart → dialog appears → click **Disagree** → field is `false`.
3. Reset again → dismiss via overlay/Esc → field is `false`.

- [ ] **Step 3: Settings**

1. Open Settings → General.
2. Toggle “Allow anonymous usage information”, click Save.
3. Confirm `smm.json` updates; no auto dialog on next launch.

- [ ] **Step 4: Final test sweep**

Run:

```bash
cd apps/ui && pnpm exec vitest run \
  src/lib/anonymousTelemetryConsent.test.ts \
  src/components/dialogs/AnonymousTelemetryConsentDialog.locale.test.ts \
  src/components/dialogs/AnonymousTelemetryConsentDialog.test.tsx \
  src/components/initialization/AnonymousTelemetryConsentGate.test.tsx \
  src/components/ui/settings/GeneralSettings.test.tsx
```

Expected: all PASS

- [ ] **Step 5: Update design status (optional)**

In `docs/superpowers/specs/2026-08-15-anonymous-telemetry-consent-design.md`, set Status to Implemented and note the commit range when done.

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| `anonymousTelemetryConsent?: boolean` on `UserConfig` | Task 1 |
| Defaults omit field | Task 1 Step 2 |
| First-launch dialog when `undefined` | Task 4 |
| Agree → `true` | Task 3 + 4 |
| Disagree / dismiss → `false` | Task 3 + 4 |
| Settings toggle, form + Save | Task 5 |
| General anonymous copy (4 locales) | Task 2 |
| No telemetry upload | Global Constraints (no task adds upload) |
| Overlay does not block AppInitializer | Task 4 mount beside initializer |
| Manual verification | Task 6 |
