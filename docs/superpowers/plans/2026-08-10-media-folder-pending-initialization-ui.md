# Media Folder Pending-Initialization UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status:** Implemented (2026-08-10, commits `48a6ad83`..`f5872859`). The plan was executed via subagent-driven development and committed incrementally; task checkboxes were not individually flipped. Do not re-run.

**Goal:** Surface the pending/initializing state during "Import Media Library" across the StatusBar, the Sidebar folder list, and the content area.

**Architecture:** Reuse the existing `pending_for_initialization` and `initializing` statuses from `UIMediaFolderStore`. StatusBar shows "初始化 <folder path>" for the currently-initializing folder (selection-independent). Sidebar's `MediaFolderListItemV2` shows a "等待初始化" badge for `pending_for_initialization` folders (pass-through in `mapFolderStatusToItemStatus`; `initializing` keeps its spinner). The content area renders a new `PendingInitializationPanel` when a selected folder is `pending_for_initialization`. All text via i18n keys added to the 4 locale files.

**Tech Stack:** React 19, TypeScript, Zustand, react-i18next, Tailwind CSS 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-10-media-folder-pending-initialization-ui-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/components.json` | New i18n keys (Task 1) |
| `apps/ui/src/components/PendingInitializationPanel.locale.test.ts` | Locale catalog regression test (Task 1) |
| `apps/ui/src/lib/sidebarRowUtils.ts` | Pass `pending_for_initialization` through (Task 2) |
| `apps/ui/src/components/sidebar/MediaFolderListItemV2.tsx` | Add `pending_for_initialization` status + badge (Task 2) |
| `apps/ui/src/lib/sidebarRowUtils.test.ts` | Update pending assertion (Task 2) |
| `apps/ui/src/components/sidebar/MediaFolderListItemV2.test.ts` | Badge tests (Task 2) |
| `apps/ui/src/components/StatusBar.tsx` | Show currently-initializing folder (Task 3) |
| `apps/ui/src/components/StatusBar.test.tsx` | StatusBar message tests (Task 3) |
| `apps/ui/src/components/PendingInitializationPanel.tsx` | New content-area panel (Task 4) |
| `apps/ui/src/AppV2.tsx` | Render panel for pending selection (Task 4) |
| `apps/ui/src/AppV2.test.tsx` | Panel render test (Task 4) |

---

### Task 1: Add i18n keys and a locale regression test

**Files:**
- Create: `apps/ui/src/components/PendingInitializationPanel.locale.test.ts`
- Modify: `apps/ui/public/locales/en/components.json`
- Modify: `apps/ui/public/locales/zh-CN/components.json`
- Modify: `apps/ui/public/locales/zh-HK/components.json`
- Modify: `apps/ui/public/locales/zh-TW/components.json`

- [ ] **Step 1: Write the failing locale test**

Create `apps/ui/src/components/PendingInitializationPanel.locale.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import en from "../../public/locales/en/components.json"
import zhCN from "../../public/locales/zh-CN/components.json"
import zhHK from "../../public/locales/zh-HK/components.json"
import zhTW from "../../public/locales/zh-TW/components.json"

interface PendingInitializationPanel {
  title: string
  description: string
}

interface Catalog {
  pendingInitializationPanel: PendingInitializationPanel
  statusBar: { messages: { initializingFolder: string } }
  mediaFolder: { pendingForInitialization: string }
}

const locales: { name: string; data: Catalog }[] = [
  { name: "en", data: en as unknown as Catalog },
  { name: "zh-CN", data: zhCN as unknown as Catalog },
  { name: "zh-HK", data: zhHK as unknown as Catalog },
  { name: "zh-TW", data: zhTW as unknown as Catalog },
]

describe("pending-initialization locale catalog", () => {
  for (const { name, data } of locales) {
    describe(name, () => {
      it("defines statusBar.messages.initializingFolder as a non-empty string", () => {
        expect(typeof data.statusBar.messages.initializingFolder).toBe("string")
        expect(data.statusBar.messages.initializingFolder.length).toBeGreaterThan(0)
      })
      it("defines mediaFolder.pendingForInitialization as a non-empty string", () => {
        expect(typeof data.mediaFolder.pendingForInitialization).toBe("string")
        expect(data.mediaFolder.pendingForInitialization.length).toBeGreaterThan(0)
      })
      it("defines pendingInitializationPanel.title and description as non-empty strings", () => {
        expect(data.pendingInitializationPanel.title.length).toBeGreaterThan(0)
        expect(data.pendingInitializationPanel.description.length).toBeGreaterThan(0)
      })
    })
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/ui && pnpm vitest run src/components/PendingInitializationPanel.locale.test.ts`
Expected: FAIL — `data.statusBar.messages.initializingFolder` is `undefined`.

- [ ] **Step 3: Add keys to `en/components.json`**

Open `apps/ui/public/locales/en/components.json`.

In `statusBar.messages` (currently `"initializationError": "Initialization Error: {{message}}"` at line 246, no trailing comma), change to:

```json
      "initializing": "Initializing...",
      "initializationError": "Initialization Error: {{message}}",
      "initializingFolder": "Initializing {{path}}"
```

In `mediaFolder` (currently `"errorLoadingMetadata": "Error loading metadata"` at line 52, no trailing comma), change to:

```json
    "renameError": "Could not rename folder: {{error}}",
    "initializing": "Initializing media folder...",
    "folderNotFound": "Folder not found",
    "errorLoadingMetadata": "Error loading metadata",
    "pendingForInitialization": "Pending initialization"
```

Add a new top-level object right after `folderNotAvailablePanel` (lines 38-41), before `mediaFolder`:

```json
  "pendingInitializationPanel": {
    "title": "Pending initialization",
    "description": "This media folder is waiting to be initialized. Content will appear automatically once initialization completes."
  },
```

- [ ] **Step 4: Add keys to `zh-CN/components.json`**

Open `apps/ui/public/locales/zh-CN/components.json`.

In `statusBar.messages` (currently `"initializationError": "初始化错误：{{message}}"` at line 245, no trailing comma), change to:

```json
      "initializing": "正在初始化...",
      "initializationError": "初始化错误：{{message}}",
      "initializingFolder": "初始化 {{path}}"
```

In `mediaFolder` (currently `"errorLoadingMetadata": "加载元数据时出错"` at line 52, no trailing comma), change to:

```json
    "renameError": "无法重命名文件夹：{{error}}",
    "initializing": "正在初始化媒体目录...",
    "folderNotFound": "文件夹未找到",
    "errorLoadingMetadata": "加载元数据时出错",
    "pendingForInitialization": "等待初始化"
```

Add a new top-level object right after `folderNotAvailablePanel` (lines 38-41), before `mediaFolder`:

```json
  "pendingInitializationPanel": {
    "title": "等待初始化",
    "description": "此媒体文件夹正在等待初始化。初始化完成后将自动显示内容。"
  },
```

- [ ] **Step 5: Add keys to `zh-HK/components.json`**

Open `apps/ui/public/locales/zh-HK/components.json`.

In `statusBar.messages` (currently `"initializationError": "初始化錯誤：{{message}}"` at line 242, no trailing comma), change to:

```json
      "initializationError": "初始化錯誤：{{message}}",
      "initializingFolder": "初始化 {{path}}"
```

In `mediaFolder` (currently `"errorLoadingMetadata": "載入元資料時出錯"` at line 50, no trailing comma), change to:

```json
    "errorLoadingMetadata": "載入元資料時出錯",
    "pendingForInitialization": "等待初始化"
```

Add a new top-level object right after `folderNotAvailablePanel` (lines 36-39), before `mediaFolder`:

```json
  "pendingInitializationPanel": {
    "title": "等待初始化",
    "description": "此媒體資料夾正在等待初始化。初始化完成後將自動顯示內容。"
  },
```

- [ ] **Step 6: Add keys to `zh-TW/components.json`**

Open `apps/ui/public/locales/zh-TW/components.json`. Apply the exact same three edits as Step 5 (identical structure; `initializationError` at line 242, `errorLoadingMetadata` at line 50, `folderNotAvailablePanel` ends at line 39).

- [ ] **Step 7: Run the locale test to verify it passes**

Run: `cd apps/ui && pnpm vitest run src/components/PendingInitializationPanel.locale.test.ts`
Expected: PASS — 12 tests (3 assertions × 4 locales) all green.

- [ ] **Step 8: Commit**

```bash
git add apps/ui/public/locales/en/components.json apps/ui/public/locales/zh-CN/components.json apps/ui/public/locales/zh-HK/components.json apps/ui/public/locales/zh-TW/components.json apps/ui/src/components/PendingInitializationPanel.locale.test.ts
git commit -m "feat(ui): add pending-initialization i18n keys to all locales"
```

---

### Task 2: Sidebar badge for `pending_for_initialization`

**Files:**
- Modify: `apps/ui/src/lib/sidebarRowUtils.ts:21-37`
- Modify: `apps/ui/src/components/sidebar/MediaFolderListItemV2.tsx:38,107-119`
- Test: `apps/ui/src/lib/sidebarRowUtils.test.ts`
- Test: `apps/ui/src/components/sidebar/MediaFolderListItemV2.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/ui/src/lib/sidebarRowUtils.test.ts`, replace the first test block (lines 5-15) with:

```ts
  it("passes through pending_for_initialization status", () => {
    const row = buildMediaFolderListItemPropsFromFolderAndMetadata(
      {
        path: "/media/Test",
        status: "pending_for_initialization",
      },
      undefined,
    )

    expect(row.status).toBe("pending_for_initialization")
  })
```

In `apps/ui/src/components/sidebar/MediaFolderListItemV2.test.ts`, append this block before the final closing `})`:

```ts
describe("MediaFolderListItemV2 pending_for_initialization status", () => {
  const path = "/media/tvshows/Pending Show"
  const mediaName = "Pending Show"

  it("renders a pending-initialization badge", () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "pending_for_initialization",
      }),
    )

    expect(screen.getByTestId("sidebar-folder-pending-initialization")).toBeInTheDocument()
  })

  it("does not show loading spinner for pending_for_initialization", () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "pending_for_initialization",
      }),
    )

    expect(document.querySelector(".animate-spin")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/ui && pnpm vitest run src/lib/sidebarRowUtils.test.ts src/components/sidebar/MediaFolderListItemV2.test.ts`
Expected: FAIL — `expect(row.status).toBe("pending_for_initialization")` receives `"idle"`; badge test finds no `sidebar-folder-pending-initialization` testid.

- [ ] **Step 3: Pass `pending_for_initialization` through in `sidebarRowUtils.ts`**

Open `apps/ui/src/lib/sidebarRowUtils.ts` and replace `mapFolderStatusToItemStatus` (lines 21-37) with:

```ts
function mapFolderStatusToItemStatus(
  status: UIMediaFolderStatus,
): NonNullable<MediaFolderListItemV2Props["status"]> {
  if (status === "updating") return "loading"
  if (status === "error_loading_metadata") return "folder_not_found"
  if (
    status === "idle" ||
    status === "pending_for_initialization" ||
    status === "initializing" ||
    status === "ok" ||
    status === "folder_not_found" ||
    status === "loading"
  ) {
    return status
  }
  return "idle"
}
```

- [ ] **Step 4: Extend the item's status type and render the badge**

Open `apps/ui/src/components/sidebar/MediaFolderListItemV2.tsx`.

Extend the `status` prop type (line 38) to:

```ts
  status?: 'idle' | 'pending_for_initialization' | 'initializing' | 'ok' | 'folder_not_found' | 'loading'
```

In the status indicator section (after the `Loader2` spinner block, around line 109), add:

```tsx
          {status === 'pending_for_initialization' && (
            <span
              className="inline-flex shrink-0 items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              data-testid="sidebar-folder-pending-initialization"
            >
              {t('mediaFolder.pendingForInitialization')}
            </span>
          )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/ui && pnpm vitest run src/lib/sidebarRowUtils.test.ts src/components/sidebar/MediaFolderListItemV2.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/sidebarRowUtils.ts apps/ui/src/lib/sidebarRowUtils.test.ts apps/ui/src/components/sidebar/MediaFolderListItemV2.tsx apps/ui/src/components/sidebar/MediaFolderListItemV2.test.ts
git commit -m "feat(ui): show pending-initialization badge in sidebar folder list"
```

---

### Task 3: StatusBar shows the currently-initializing folder

**Files:**
- Modify: `apps/ui/src/components/StatusBar.tsx:50,57-74`
- Test: `apps/ui/src/components/StatusBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `apps/ui/src/components/StatusBar.test.tsx`:

(a) Update the `t` mock (lines 72-90) so `opts` also carries `path`, and register the new key:

```ts
    t: (key: string, opts?: { message?: string; path?: string }) => {
        const messages: Record<string, string> = {
            "statusBar.messages.initializing": "Initializing...",
            "statusBar.messages.initializationError": `Initialization Error: ${opts?.message ?? ""}`,
            "statusBar.messages.initializingFolder": `Initializing ${opts?.path ?? ""}`,
            "statusBar.messages.tmdbUnavailable": "TMDB is unavailable",
            "statusBar.messages.tmdbAvailable": "TMDB is available",
            "statusBar.messages.tmdbCheckFailed": "TMDB check failed",
            "statusBar.messages.tvdbUnavailable": "TVDB is unavailable",
            "statusBar.messages.tvdbAvailable": "TVDB is available",
            "statusBar.messages.tvdbCheckFailed": "TVDB check failed",
            "statusBar.messages.videoCaptionerAvailable": "VideoCaptioner is available",
            "statusBar.messages.videoCaptionerNotFound": "videocaptioner not found",
            "statusBar.messages.transcribeUnavailableOnOs":
                "Subtitle generation is not available on this operating system.",
        }
        return messages[key] ?? key
    },
```

(b) Append these two `it` blocks before the final closing `})` of `describe("StatusBar", () => {`:

```ts
    it("shows currently-initializing folder when a folder is initializing", () => {
        mockUseUIMediaFolderStoreState.mockReturnValue({
            folders: [
                { path: "/media/library/Show A", status: "initializing" },
                { path: "/media/library/Show B", status: "pending_for_initialization" },
            ],
            selectedFolder: "/media/library/Show B",
            selectedFolders: [],
        })

        render(<StatusBar />)

        expect(screen.getByTestId("status-bar-message")).toHaveTextContent(
            `Initializing ${Path.toPlatformPath("/media/library/Show A")}`,
        )
    })

    it("falls back to selected folder when no folder is initializing", () => {
        mockUseUIMediaFolderStoreState.mockReturnValue({
            folders: [
                { path: "/media/library/Show B", status: "pending_for_initialization" },
            ],
            selectedFolder: "/media/library/Show B",
            selectedFolders: [],
        })

        render(<StatusBar />)

        expect(screen.getByTestId("status-bar-message")).toHaveTextContent(
            Path.toPlatformPath("/media/library/Show B"),
        )
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/ui && pnpm vitest run src/components/StatusBar.test.tsx`
Expected: FAIL — the first new test renders the selected folder path (`Show B`) instead of `Initializing ...Show A`.

- [ ] **Step 3: Implement the StatusBar message**

Open `apps/ui/src/components/StatusBar.tsx`.

Change the store destructure (line 50) from `const { selectedFolder } = useUIMediaFolderStoreState()` to:

```ts
    const { folders, selectedFolder } = useUIMediaFolderStoreState()
```

Add the `initializingFolder` derivation after the `folderPathMessage` useMemo (after line 60):

```ts
    const initializingFolder = useMemo(
        () => folders.find((f) => f.status === "initializing"),
        [folders],
    )
```

Update the `displayMessage` useMemo (lines 63-74) to insert the new branch between the bootstrap-error branch and the folder-path fallback:

```ts
    const displayMessage = useMemo(() => {
        if (message !== undefined) return message
        if (bootstrap.status === "initializing") {
            return t("statusBar.messages.initializing")
        }
        if (bootstrap.status === "error") {
            return t("statusBar.messages.initializationError", {
                message: bootstrap.message,
            })
        }
        if (initializingFolder) {
            return t("statusBar.messages.initializingFolder", {
                path: Path.toPlatformPath(initializingFolder.path),
            })
        }
        return folderPathMessage
    }, [message, bootstrap, initializingFolder, folderPathMessage, t])
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/ui && pnpm vitest run src/components/StatusBar.test.tsx`
Expected: PASS — all StatusBar tests green, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/StatusBar.tsx apps/ui/src/components/StatusBar.test.tsx
git commit -m "feat(ui): show currently-initializing folder in StatusBar"
```

---

### Task 4: Pending-initialization panel in the content area

**Files:**
- Create: `apps/ui/src/components/PendingInitializationPanel.tsx`
- Modify: `apps/ui/src/AppV2.tsx:334-379`
- Test: `apps/ui/src/AppV2.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `apps/ui/src/AppV2.test.tsx`:

(a) Add a mock for the new panel, after the `vi.mock("./components/LocalFilePanel", ...)` block (line 89-93):

```tsx
vi.mock("./components/PendingInitializationPanel", () => ({
  PendingInitializationPanel: () => <div data-testid="pending-initialization-panel" />,
}))
```

(b) Widen the `arrange` signature (line 127-153) to accept the new statuses and return no metadata for a pending folder:

```tsx
  function arrange({
    folderStatus,
  }: {
    folderStatus:
      | "ok"
      | "error_loading_metadata"
      | "loading"
      | "pending_for_initialization"
      | "initializing"
  }) {
    const selectedFolder = "/media/local-folder"
    const folders = [{ path: selectedFolder, status: folderStatus }]

    mockUseUIMediaFolderStoreState.mockReturnValue({
      folders,
      selectedFolder,
    })
    mockUseUIMediaFolderStore.mockImplementation(
      (selector: (state: { folders: Array<{ path: string; status: string }> }) => unknown) =>
        selector({ folders }),
    )
    mockGetState.mockReturnValue({
      selectedFolder,
      applyFolderClick: vi.fn(),
    })
    mockUseMediaMetadataQuery.mockReturnValue({
      data:
        folderStatus === "pending_for_initialization"
          ? undefined
          : {
              mediaFolderPath: selectedFolder,
              type: "local-folder",
            },
    })
  }
```

(c) Append this test before the final closing `})`:

```tsx
  it("renders PendingInitializationPanel when folder status is pending_for_initialization", () => {
    arrange({ folderStatus: "pending_for_initialization" })
    renderApp()

    expect(screen.getByTestId("pending-initialization-panel")).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/ui && pnpm vitest run src/AppV2.test.tsx`
Expected: FAIL — `pending-initialization-panel` is not in the document.

- [ ] **Step 3: Create the panel component**

Create `apps/ui/src/components/PendingInitializationPanel.tsx`:

```tsx
import { useTranslation } from "react-i18next"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"

export function PendingInitializationPanel() {
  const { t } = useTranslation("components", { keyPrefix: "pendingInitializationPanel" })
  const { selectedFolder } = useUIMediaFolderStoreState()

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center overflow-auto p-6 text-center"
      data-testid="pending-initialization-panel"
    >
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {selectedFolder ? (
          <p className="text-muted-foreground mt-4 break-all font-mono text-xs">{selectedFolder}</p>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the panel into `AppV2.tsx`**

Open `apps/ui/src/AppV2.tsx`.

Add the import after the `FolderNotAvailablePanel` import (line 17):

```tsx
import { PendingInitializationPanel } from "./components/PendingInitializationPanel"
```

In the content-area render (after the `FolderNotAvailablePanel` branch at line 340-342), add the pending branch:

```tsx
                      {uiFolders.length > 0 && selectedFolder && folderStatus === "pending_for_initialization" && (
                        <PendingInitializationPanel />
                      )}
```

Guard the metadata-driven branch (line 343) so it never renders for a pending folder (in case metadata is present in the cache):

```tsx
                      {uiFolders.length > 0 &&
                        folderStatus !== "folder_not_found" &&
                        folderStatus !== "pending_for_initialization" &&
                        selectedMediaMetadata && (
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/ui && pnpm vitest run src/AppV2.test.tsx`
Expected: PASS — including the new `PendingInitializationPanel` test and the existing LocalFilePanel tests.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/PendingInitializationPanel.tsx apps/ui/src/AppV2.tsx apps/ui/src/AppV2.test.tsx
git commit -m "feat(ui): show pending-initialization panel for selected pending folder"
```

---

### Task 5: Full verification and doc status

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-media-folder-pending-initialization-ui.md` (status banner)
- Modify: `docs/superpowers/specs/2026-08-10-media-folder-pending-initialization-ui-design.md` (status banner)

- [ ] **Step 1: Run the full ui unit test suite**

Run: `cd apps/ui && pnpm vitest run`
Expected: PASS — all UI tests green (no regressions from the changed `MediaFolderListItemV2` status type, StatusBar logic, or AppV2 branches).

- [ ] **Step 2: Run the ui typecheck**

Run: `cd apps/ui && pnpm run typecheck`
Expected: PASS — `tsc --noEmit` with no errors. (Confirm no other consumer of `MediaFolderListItemV2Props["status"]` or `mapFolderStatusToItemStatus` broke.)

- [ ] **Step 3: Add a Status banner to the plan and spec**

Add this at the top of `docs/superpowers/plans/2026-08-10-media-folder-pending-initialization-ui.md` (after the header blockquote) and to `docs/superpowers/specs/2026-08-10-media-folder-pending-initialization-ui-design.md`:

```markdown
> **Status:** ✅ Implemented
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-08-10-media-folder-pending-initialization-ui.md docs/superpowers/specs/2026-08-10-media-folder-pending-initialization-ui-design.md
git commit -m "docs(ui): mark pending-initialization feature implemented"
```
