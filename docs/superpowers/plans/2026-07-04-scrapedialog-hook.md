# ScrapeDialog → useScrapeDialog Hook Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the container-component `ScrapeDialog` with a `useScrapeDialog` hook (business logic) and have the sole consumer (`providers/dialog-provider.tsx`) compose it directly with the existing pure-UI `UIScrapeDialog`. Behavior-preserving.

**Architecture:** Extract the body of `ScrapeDialog` into a new hook file that returns `{ tasks, isRunning, allTasksDone, showButtons, cancelDisabled, canDismissIncidentally, handleCancel, handleStart }`. Keep `UIScrapeDialog` unchanged. Update the one consumer. Move tests onto the hook by renaming `ScrapeDialog.test.tsx` → `useScrapeDialog.test.tsx` and replacing the rendered component with a 5-line test harness that calls the hook + renders `UIScrapeDialog` with the returned bindings.

**Tech Stack:** React 19 + TypeScript + `@tanstack/react-query` (mutations) + Vitest + Testing Library + shadcn/ui Dialog primitives. Existing codebase patterns: pnpm workspace, ESLint 9 flat config.

**Working directory for all commands:** `C:\Users\lawrence\workspace\smm_github`

---

## File Map

**Create:**
- `apps/ui/src/components/dialogs/useScrapeDialog.ts` — hook with declared and exported `UseScrapeDialogInput` / `UseScrapeDialogResult` types.
- `apps/ui/src/components/dialogs/useScrapeDialog.test.tsx` — tests for the hook via a test harness.

**Delete:**
- `apps/ui/src/components/dialogs/ScrapeDialog.tsx`
- `apps/ui/src/components/dialogs/ScrapeDialog.test.tsx`

**Modify:**
- `apps/ui/src/providers/dialog-provider.tsx` — replace `<ScrapeDialog>` JSX with hook + `<UIScrapeDialog>` composition; update imports.
- `apps/ui/src/components/dialogs/index.ts` — swap exports (`ScrapeDialog` → `useScrapeDialog`; remove `ScrapeDialogProps`; add `UseScrapeDialogInput`, `UseScrapeDialogResult`).
- `apps/ui/src/components/dialogs/types/index.ts` — remove `ScrapeDialogProps` and the `MediaMetadata` import made solely for it; re-export `UseScrapeDialogInput` / `UseScrapeDialogResult` from `./useScrapeDialog`.

**Untouched:**
- `UIScrapeDialog.tsx`, `UIScrapeDialog.test.tsx`, `UIScrapeDialogTable.tsx`
- `lib/scrapeDialog/*`
- All `@/hooks/useScrape*Mutation` hooks
- Every other dialog wrapper (`ProcessPipelineDialog`, `TranscribeDialog`, etc.) — out of scope.

---

## Pre-flight: confirm the current test suite is green

- [ ] **Step 1: Run baseline tests for the scrape area**

Run:

```bash
pnpm -C apps/ui test -- ScrapeDialog UIScrapeDialog
```

Expected: All passing. Capture baseline so we can spot regressions from the refactor.

---

## Task 1: Create `useScrapeDialog.ts` (the hook)

**Files:**
- Create: `apps/ui/src/components/dialogs/useScrapeDialog.ts`

- [ ] **Step 1: Create the hook file with self-declared types**

Write the following content to `apps/ui/src/components/dialogs/useScrapeDialog.ts` exactly:

```ts
import { useCallback, useEffect, useMemo, useReducer } from "react"
import { useScrapeNfoMutation } from "@/hooks/useScrapeNfoMutation"
import { useScrapePosterMutation } from "@/hooks/useScrapePosterMutation"
import { useScrapeFanartMutation } from "@/hooks/useScrapeFanartMutation"
import { useScrapeThumbnailMutation } from "@/hooks/useScrapeThumbnailMutation"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import {
  areAllTasksDone,
  checkTaskCompletion,
  createInitialScrapeTasksForMedia,
  INITIAL_SCRAPE_TASK_STATE,
  taskReducer,
  type ScrapeTaskId,
  type ScrapeTaskView,
} from "@/lib/scrapeDialog"

export interface UseScrapeDialogInput {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}

export interface UseScrapeDialogResult {
  tasks: ScrapeTaskView[]
  isRunning: boolean
  allTasksDone: boolean
  showButtons: boolean
  cancelDisabled: boolean
  canDismissIncidentally: boolean
  handleCancel: () => void
  handleStart: () => Promise<void>
}

export function useScrapeDialog({
  isOpen,
  onClose,
  mediaMetadata,
}: UseScrapeDialogInput): UseScrapeDialogResult {
  const { mutateAsync: scrapePoster } = useScrapePosterMutation()
  const { mutateAsync: scrapeFanart } = useScrapeFanartMutation()
  const { mutateAsync: scrapeThumbnail } = useScrapeThumbnailMutation()
  const { mutateAsync: scrapeNfo } = useScrapeNfoMutation()
  const { userConfig } = useConfig()
  const { mutateAsync: refreshMediaMetadata } = useFetchMediaMetadataMutation()
  const [state, dispatch] = useReducer(taskReducer, INITIAL_SCRAPE_TASK_STATE)

  const executeTask = useCallback(
    async (id: ScrapeTaskId, currentMediaMetadata: MediaMetadata) => {
      if (id === "poster") {
        await scrapePoster({
          mediaMetadata: currentMediaMetadata,
          language: userConfig.preferMediaLanguage,
        })
        return
      }
      if (id === "fanart") {
        await scrapeFanart({
          mediaMetadata: currentMediaMetadata,
          language: userConfig.preferMediaLanguage,
        })
        return
      }
      if (id === "thumbnails") {
        await scrapeThumbnail({ mediaMetadata: currentMediaMetadata })
        return
      }
      await scrapeNfo({ mediaMetadata: currentMediaMetadata })
    },
    [scrapePoster, scrapeFanart, userConfig.preferMediaLanguage, scrapeThumbnail, scrapeNfo],
  )

  useEffect(() => {
    if (!isOpen || !mediaMetadata) return

    dispatch({ type: "INIT", tasks: createInitialScrapeTasksForMedia(mediaMetadata) })

    let cancelled = false
    checkTaskCompletion(mediaMetadata)
      .then((completion) => {
        if (cancelled) return
        dispatch({ type: "SET_COMPLETION", completion })
      })
      .catch((error) => {
        console.error("[ScrapeDialog] initialize completion failed:", error)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, mediaMetadata])

  const allTasksDone = useMemo(() => areAllTasksDone(state.tasks), [state.tasks])
  const canDismissIncidentally = allTasksDone && !state.isRunning
  const cancelDisabled = state.isRunning
  const showButtons = mediaMetadata !== undefined

  const handleCancel = useCallback(() => {
    if (cancelDisabled) return
    onClose()
  }, [cancelDisabled, onClose])

  const handleStart = useCallback(async () => {
    if (!mediaMetadata) return
    if (allTasksDone) {
      onClose()
      return
    }
    if (state.isRunning) return

    dispatch({ type: "START_RUN" })
    const traceId = `ScrapeDialog-handleStart-${nextTraceId()}`
    try {
      const taskStatusMap = new Map(state.tasks.map((task) => [task.id, task.status]))
      for (const task of state.tasks) {
        const id = task.id
        const status = taskStatusMap.get(id)
        if (status === "completed" || status === "failed") continue
        dispatch({ type: "MARK_RUNNING", id })
        try {
          await executeTask(id, mediaMetadata)
          dispatch({ type: "MARK_COMPLETED", id })
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          dispatch({ type: "MARK_FAILED", id, reason })
          console.error(`[ScrapeDialog] task ${id} failed:`, error)
        }
      }
      if (mediaMetadata.mediaFolderPath) {
        await refreshMediaMetadata({ path: mediaMetadata.mediaFolderPath, traceId })
      }
    } catch (error) {
      console.error("[ScrapeDialog] run failed:", error)
    } finally {
      dispatch({ type: "FINISH_RUN" })
    }
  }, [
    mediaMetadata,
    allTasksDone,
    state.isRunning,
    state.tasks,
    executeTask,
    refreshMediaMetadata,
    onClose,
  ])

  return {
    tasks: state.tasks,
    isRunning: state.isRunning,
    allTasksDone,
    showButtons,
    cancelDisabled,
    canDismissIncidentally,
    handleCancel,
    handleStart,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm -C apps/ui typecheck
```

Expected: 0 errors. (No consumer yet, so the hook is unused but type-clean.)

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/dialogs/useScrapeDialog.ts
git commit -m "feat(ui): extract useScrapeDialog hook from ScrapeDialog"
```

---

## Task 2: Replace `ScrapeDialog.test.tsx` with `useScrapeDialog.test.tsx` (test harness)

**Files:**
- Create: `apps/ui/src/components/dialogs/useScrapeDialog.test.tsx`
- Delete: `apps/ui/src/components/dialogs/ScrapeDialog.test.tsx`

- [ ] **Step 1: Write the new test file with a harness that uses the hook and renders `UIScrapeDialog`**

Write the following content to `apps/ui/src/components/dialogs/useScrapeDialog.test.tsx` exactly. The mocks and assertions are copied verbatim from the existing `ScrapeDialog.test.tsx`; the only differences are the imports and the harness component:

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { UIScrapeDialog } from "./UIScrapeDialog"
import { useScrapeDialog, type UseScrapeDialogInput } from "./useScrapeDialog"

const scrapePosterMock = vi.fn()
const scrapeFanartMock = vi.fn()
const scrapeThumbnailMock = vi.fn()
const scrapeNfoMock = vi.fn()
const refreshMediaMetadataMock = vi.fn().mockResolvedValue(undefined)
const listFilesMock = vi.fn().mockResolvedValue({ data: { items: [] } })
const userConfigMock = { preferMediaLanguage: "zh-CN" }

vi.mock("@/hooks/useScrapeNfoMutation", () => ({
  useScrapeNfoMutation: () => ({ mutateAsync: scrapeNfoMock }),
}))
vi.mock("@/hooks/useScrapePosterMutation", () => ({
  useScrapePosterMutation: () => ({ mutateAsync: scrapePosterMock }),
}))
vi.mock("@/hooks/useScrapeFanartMutation", () => ({
  useScrapeFanartMutation: () => ({ mutateAsync: scrapeFanartMock }),
}))
vi.mock("@/hooks/useScrapeThumbnailMutation", () => ({
  useScrapeThumbnailMutation: () => ({ mutateAsync: scrapeThumbnailMock }),
}))
vi.mock(
  "@/hooks/mediaMetadata/useFetchMediaMetadataMutation",
  () => ({
    useFetchMediaMetadataMutation: () => ({
      mutateAsync: refreshMediaMetadataMock,
    }),
  }),
)
vi.mock("@/api/listFiles", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}))
vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({ userConfig: userConfigMock }),
}))

const I18N_KEYS: Record<string, string> = {
  "scrape.tasks.poster": "海报",
  "scrape.tasks.fanart": "背景图",
  "scrape.tasks.thumbnails": "每集封面",
  "scrape.tasks.nfo": "nfo",
  "scrape.status.pending": "未下载",
  "scrape.status.running": "运行中",
  "scrape.status.completed": "已完成",
  "scrape.status.failed": "失败",
  "scrape.errors.imageUrlTimeout": "图片链接访问超时",
  "scrape.errors.imageUrlNotFound": "图片链接域名无法解析",
  "scrape.errors.imageUrlConnectionRefused": "图片链接连接被拒绝",
  "scrape.errors.imageUrlNetworkFailed": "图片链接网络连接失败",
  "scrape.defaultTitle": "任务进度",
  "scrape.defaultDescription": "当前任务执行状态",
  "scrape.start": "开始",
  "scrape.done": "完成",
  "scrape.columns.file": "文件",
  "scrape.columns.status": "状态",
  "scrape.noTasks": "没有任务",
  cancel: "取消",
}

const stableT = (key: string) => I18N_KEYS[key] ?? key
const stableI18n = { t: stableT }

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => stableI18n,
}))

function Harness(props: UseScrapeDialogInput) {
  const dlg = useScrapeDialog(props)
  return (
    <UIScrapeDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      tasks={dlg.tasks}
      isRunning={dlg.isRunning}
      allTasksDone={dlg.allTasksDone}
      showButtons={dlg.showButtons}
      cancelDisabled={dlg.cancelDisabled}
      canDismissIncidentally={dlg.canDismissIncidentally}
      onCancel={dlg.handleCancel}
      onStart={dlg.handleStart}
    />
  )
}

describe("useScrapeDialog — movie folder tasks", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    listFilesMock.mockReset()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
  })

  it("does not show the thumbnails row for movie folders", async () => {
    render(<Harness isOpen onClose={vi.fn()} mediaMetadata={mediaMetadata} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-row-poster")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("scrape-dialog-task-row-thumbnails")).not.toBeInTheDocument()
    expect(screen.queryByText("每集封面")).not.toBeInTheDocument()
  })
})

describe("useScrapeDialog — error propagation", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    scrapePosterMock.mockReset()
    scrapeFanartMock.mockReset()
    scrapeThumbnailMock.mockReset()
    scrapeNfoMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
  })

  it("captures the server's raw error message and shows the localized error in the status column", async () => {
    scrapePosterMock.mockRejectedValue(
      new Error(
        "Image URL fetch failed: Unable to connect. Is the computer able to access the url? (ConnectionRefused)",
      ),
    )
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <Harness isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接连接被拒绝")
    })

    const fanartStatus = screen.getByTestId("scrape-dialog-task-status-fanart")
    expect(fanartStatus.textContent).toContain("已完成")
  })

  it("shows 'Failed' (no localized reason) when the error message is empty", async () => {
    scrapePosterMock.mockRejectedValue(new Error(""))
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <Harness isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("失败")
    })
  })

  it("captures ETIMEDOUT and localizes it as '图片链接访问超时'", async () => {
    scrapePosterMock.mockRejectedValue(
      new Error(
        "Failed to download image: fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
      ),
    )
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <Harness isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接访问超时")
    })
  })
})

describe("useScrapeDialog — cancel button", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    scrapePosterMock.mockReset()
    scrapeFanartMock.mockReset()
    scrapeThumbnailMock.mockReset()
    scrapeNfoMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
    scrapePosterMock.mockResolvedValue(undefined)
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)
  })

  it("keeps cancel enabled with pending tasks and closes on cancel click", async () => {
    const onClose = vi.fn()
    render(
      <Harness isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "未下载",
      )
    })

    const cancel = screen.getByTestId("scrape-dialog-cancel")
    expect(cancel).not.toBeDisabled()
    fireEvent.click(cancel)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps cancel enabled when some tasks are completed but scrape has not started", async () => {
    listFilesMock.mockResolvedValue({
      data: { items: [{ path: "/media/Movie/poster.jpg" }] },
    })

    const onClose = vi.fn()
    render(
      <Harness isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "已完成",
      )
      expect(screen.getByTestId("scrape-dialog-task-status-fanart").textContent).toContain(
        "未下载",
      )
    })

    expect(screen.getByTestId("scrape-dialog-cancel")).not.toBeDisabled()
    fireEvent.click(screen.getByTestId("scrape-dialog-cancel"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("disables cancel while scrape is running", async () => {
    let resolvePoster!: () => void
    scrapePosterMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePoster = resolve
        }),
    )

    render(
      <Harness isOpen onClose={vi.fn()} mediaMetadata={mediaMetadata} />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "未下载",
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-cancel")).toBeDisabled()
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "运行中",
      )
    })

    resolvePoster()

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "已完成",
      )
    })
  })
})
```

- [ ] **Step 2: Delete the old test file**

```bash
rm apps/ui/src/components/dialogs/ScrapeDialog.test.tsx
```

Expected: file is gone (no errors expected from this step alone — the old test would fail to import once the old component is removed; that's why we delete only after the new file is in place).

- [ ] **Step 3: Run the renamed test file in isolation**

```bash
pnpm -C apps/ui test -- useScrapeDialog
```

Expected: all tests pass (the same set that previously lived under `ScrapeDialog.test.tsx`, now driven through the harness). If any test fails, the most common cause is that the hooks state initializer runs differently inside the harness than it did inside `ScrapeDialog` — confirm by re-reading the hook state init against Task 1 step 1.

- [ ] **Step 4: Run `UIScrapeDialog.test.tsx` to confirm UI tests are still green**

```bash
pnpm -C apps/ui test -- UIScrapeDialog
```

Expected: all tests pass (this file was not modified).

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/dialogs/useScrapeDialog.test.tsx \
        apps/ui/src/components/dialogs/ScrapeDialog.test.tsx
git commit -m "test(ui): move ScrapeDialog tests onto useScrapeDialog harness"
```

(`git rm` is implied for `ScrapeDialog.test.tsx`; the explicit `git add` includes the new test file, the deletion is automatic.)

---

## Task 3: Update `dialog-provider.tsx` to use the hook + `UIScrapeDialog`

**Files:**
- Modify: `apps/ui/src/providers/dialog-provider.tsx`

- [ ] **Step 1: Update the import block**

In `apps/ui/src/providers/dialog-provider.tsx`, find the import from `@/components/dialogs` (around line 4–28). Replace the `ScrapeDialog` named import with `UIScrapeDialog`, and add `useScrapeDialog` to the same import. The updated block must read exactly:

```ts
import {
  ConfirmationDialog,
  SpinnerDialog,
  ConfigDialog,
  FilePickerDialog,
  DownloadVideoDialog,
  MediaSearchDialog,
  RenameFileDialog,
  TextDialog,
  RenameFolderDialog,
  OpenFolderDialog,
  UIScrapeDialog,
  FormatConverterDialog,
  VideoCompressionDialog,
  MediaFilePropertyDialog,
  ExecuteCmdDialog,
  AddTestBackgroundJobDialog,
  LogDialog,
  useScrapeDialog,
  type DialogConfig,
  type FolderType,
  type FileItem,
  type Task,
  type TrackProperties,
  type ExecuteCmdType,
} from "@/components/dialogs"
```

(`ScrapeDialog` removed; `UIScrapeDialog` and `useScrapeDialog` added in its place.)

- [ ] **Step 2: Add `useScrapeDialog` call near the existing scrape state hooks**

Locate the existing scrape-related hooks (openScrape, closeScrape — around line 369–379). Immediately AFTER the `closeScrape` callback, add:

```ts
  const scrape = useScrapeDialog({
    isOpen: isScrapeOpen,
    onClose: closeScrape,
    mediaMetadata: scrapeOptions.mediaMetadata,
  })
```

The precise insertion point: just after the closing `}, [closeScrape, …])` of `closeScrape`, before the next existing declaration (`openMediaFileProperty`). Review the surrounding 5 lines before placing it so the indentation matches the file.

- [ ] **Step 3: Replace the `<ScrapeDialog>` JSX with `<UIScrapeDialog>` bound to the hook**

Locate the current JSX (around line 570):

```tsx
      <ScrapeDialog
        isOpen={isScrapeOpen}
        onClose={closeScrape}
        mediaMetadata={scrapeOptions.mediaMetadata}
      />
```

Replace it ENTIRELY with:

```tsx
      <UIScrapeDialog
        isOpen={isScrapeOpen}
        onClose={closeScrape}
        tasks={scrape.tasks}
        isRunning={scrape.isRunning}
        allTasksDone={scrape.allTasksDone}
        showButtons={scrape.showButtons}
        cancelDisabled={scrape.cancelDisabled}
        canDismissIncidentally={scrape.canDismissIncidentally}
        onCancel={scrape.handleCancel}
        onStart={scrape.handleStart}
      />
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm -C apps/ui typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Run dialog-provider-adjacent tests if present, otherwise full vitest run**

```bash
pnpm -C apps/ui test
```

Expected: full suite passes. If a pre-existing test file imports `ScrapeDialog` from `@/components/dialogs`, it would fail — grep for it:

```bash
grep -rn "ScrapeDialog" apps/ui/src
```

Only the test file we already removed (Task 2), plus historical types files, should match.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/providers/dialog-provider.tsx
git commit -m "refactor(ui): compose UIScrapeDialog via useScrapeDialog in dialog-provider"
```

---

## Task 4: Delete `ScrapeDialog.tsx`

**Files:**
- Delete: `apps/ui/src/components/dialogs/ScrapeDialog.tsx`

- [ ] **Step 1: Confirm no remaining imports**

```bash
grep -rn 'from "./ScrapeDialog"\|/ScrapeDialog["\x27]' apps/ui/src
grep -rn 'ScrapeDialog' apps/ui/src
```

Expected: only the test file we removed (Task 2) and the index/barrel exports (we'll update those in Task 5) match. No production source file should import the old component.

- [ ] **Step 2: Delete the component file**

```bash
rm apps/ui/src/components/dialogs/ScrapeDialog.tsx
```

- [ ] **Step 3: Run typecheck and full test suite**

```bash
pnpm -C apps/ui typecheck
pnpm -C apps/ui test
```

Expected: typecheck 0 errors, all tests passing.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/dialogs/ScrapeDialog.tsx
git commit -m "refactor(ui): remove ScrapeDialog wrapper in favor of useScrapeDialog hook"
```

---

## Task 5: Update `types/index.ts` and `index.ts` (barrel) to swap exports

**Files:**
- Modify: `apps/ui/src/components/dialogs/types/index.ts`
- Modify: `apps/ui/src/components/dialogs/index.ts`

- [ ] **Step 1: Update `types/index.ts`**

Edit `apps/ui/src/components/dialogs/types/index.ts` with three precise changes:

1. Add at the bottom (after the existing `export type { ScrapeTaskId, ScrapeTaskStatus, ScrapeTaskView } …` block, around line 92):

```ts
export type { UseScrapeDialogInput, UseScrapeDialogResult } from "../useScrapeDialog"
```

2. Remove the `ScrapeDialogProps` declaration near the bottom of the file (around lines 107–109):

```ts
export type ScrapeDialogProps = Pick<UIScrapeDialogProps, "isOpen" | "onClose"> & {
  mediaMetadata?: MediaMetadata
}
```

3. If `MediaMetadata` is no longer referenced anywhere else in this file (read it first to confirm — it's only used by `ScrapeDialogProps`), also remove the import near the top:

```ts
import type { MediaMetadata } from "@core/types"
```

- [ ] **Step 2: Update `index.ts` (dialogs barrel)**

In `apps/ui/src/components/dialogs/index.ts`:

1. Replace:

```ts
export { ScrapeDialog } from "./ScrapeDialog"
export { UIScrapeDialog } from "./UIScrapeDialog"
```

with:

```ts
export { UIScrapeDialog } from "./UIScrapeDialog"
export { useScrapeDialog } from "./useScrapeDialog"
```

2. In the `export type` block at the bottom, replace:

```ts
  ScrapeDialogProps,
  UIScrapeDialogProps,
  ScrapeTaskView,
  ScrapeTaskId,
  ScrapeTaskStatus,
```

with:

```ts
  UIScrapeDialogProps,
  UseScrapeDialogInput,
  UseScrapeDialogResult,
  ScrapeTaskView,
  ScrapeTaskId,
  ScrapeTaskStatus,
```

(Precise lines: review the file before editing — only the `ScrapeDialogProps` line is removed and `UseScrapeDialogInput` / `UseScrapeDialogResult` lines added.)

- [ ] **Step 3: Run typecheck and full test suite**

```bash
pnpm -C apps/ui typecheck
pnpm -C apps/ui test
```

Expected: 0 typecheck errors; all tests pass.

- [ ] **Step 4: Run lint**

```bash
pnpm -C apps/ui lint
```

Expected: no new lint errors or warnings attributable to the refactor.

- [ ] **Step 5: Final grep verification**

```bash
grep -rn "ScrapeDialog" apps/ui/src
```

Expected: only the renamed test file `useScrapeDialog.test.tsx` and the historical references in `UIScrapeDialogTable.tsx` / `UIScrapeDialog.tsx` (whose `data-testid` attributes reference `scrape-dialog-*` strings — those are DOM hooks and are intentionally kept). No production source file should mention `ScrapeDialog` as a symbol anymore.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/dialogs/types/index.ts \
        apps/ui/src/components/dialogs/index.ts
git commit -m "refactor(ui): swap ScrapeDialog exports for useScrapeDialog in barrel and types"
```

---

## Done Criteria

- `apps/ui` typecheck green.
- `apps/ui` vitest green (all tests, not just the scrape ones).
- `apps/ui` lint green.
- No production source file imports `ScrapeDialog`.
- `UIScrapeDialog` UI behavior unchanged (existing `UIScrapeDialog.test.tsx` still passes without modification).
- Hook behavior matches the previous component (existing tests moved to `useScrapeDialog.test.tsx` still pass).
