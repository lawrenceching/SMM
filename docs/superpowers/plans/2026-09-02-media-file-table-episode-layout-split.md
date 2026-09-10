# MediaFileTableEpisodeRow Layout Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `MediaFileTableEpisodeRow` into three layout-specific components (`MediaFileTableEpisodeSimpleRow`, `MediaFileTableEpisodeDetailRow`, `MediaFileTableEpisodePreviewRow`) to eliminate mixed layout HTML and improve maintainability.

**Architecture:** Create three new component files in `apps/ui/src/components/media/episodeRows/`, each responsible for one layout. The existing `MediaFileTableRow.tsx` exports shared utilities (`MediaFileTableTr`, `withContextMenu`, `UICheckCell`, `UIThumbnailImage`, etc.) that the new components import. `MediaFileTableEpisodeRow` remains unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeSimpleRow.tsx` | Simple layout episode row |
| Create | `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeDetailRow.tsx` | Detail layout episode row |
| Create | `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodePreviewRow.tsx` | Preview layout episode row |
| Modify | `apps/ui/src/components/media/MediaFileTableRow.tsx` | Export shared utilities |

---

## Task 1: Export shared utilities from MediaFileTableRow.tsx

**Files:**
- Modify: `apps/ui/src/components/media/MediaFileTableRow.tsx`

**Interfaces:**
- Consumes: None
- Produces: `MediaFileTableTr`, `withContextMenu`, `UICheckCell`, `UIThumbnailImage`, `getMediaFileTableRowKey`, `getDisplayPath`, `getThumbnailImageUrl` as named exports

- [ ] **Step 1: Add `export` keyword to shared functions**

In `MediaFileTableRow.tsx`, add `export` to these existing functions:

```typescript
// Line 83: Add export
export function UICheckCell({ value }: { value: string | undefined }) {

// Line 99: Add export
export function UIThumbnailImage({

// Line 112: Add export
export function getMediaFileTableRowKey(

// Line 65: Add export
export function getDisplayPath(fullPath: string, basePath: string | undefined): string {

// Line 74: Add export
export function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {

// Line 144: Add export
export function withContextMenu<R extends UIMediaFileDataRow | UIMediaFileFolderRow>(
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (adding exports doesn't break anything)

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/media/MediaFileTableRow.tsx
git commit -m "refactor(media): export shared episode row utilities for layout split"
```

---

## Task 2: Create MediaFileTableEpisodeSimpleRow

**Files:**
- Create: `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeSimpleRow.tsx`

**Interfaces:**
- Consumes: `MediaFileTableRowContext`, `UIMediaFileDataRow` from `MediaFileTableRow.tsx`
- Produces: `MediaFileTableEpisodeSimpleRow` component (renders `<tr>` with simple layout cells)

- [ ] **Step 1: Create the episodeRows directory**

```bash
mkdir -p apps/ui/src/components/media/episodeRows
```

- [ ] **Step 2: Write MediaFileTableEpisodeSimpleRow.tsx**

```typescript
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import {
  MediaFileTableTr,
  MediaFileTableRowCells,
  withContextMenu,
  UICheckCell,
  getMediaFileTableRowKey,
  getDisplayPath,
  type MediaFileTableRowContext,
} from "../MediaFileTableRow"
import type { UIMediaFileDataRow } from "../UIMediaFileTable"

function renderVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): React.ReactNode {
  if (row.videoFile) {
    if (ctx.preview === "rename" && !row.newVideoFile && ctx.isSelected(row)) {
      return (
        <div
          className="truncate text-muted-foreground/60 line-through text-xs"
          title={row.videoFile}
        >
          {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
        </div>
      )
    }
    if (
      ctx.preview === "rename" &&
      row.newVideoFile &&
      row.videoFile !== row.newVideoFile
    ) {
      return (
        <div className="min-w-0 space-y-0.5">
          <div
            className="truncate text-muted-foreground/60 line-through text-xs"
            title={row.videoFile}
            data-testid="media-file-table-old-video-file"
          >
            {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
          </div>
          <div
            className="truncate text-foreground font-medium"
            title={row.newVideoFile}
            data-testid="media-file-table-new-video-file"
          >
            {getDisplayPath(row.newVideoFile, ctx.mediaFolderPath)}
          </div>
        </div>
      )
    }
    return (
      <div
        className={cn("truncate", isRowDisabled && "text-muted-foreground/60 text-xs")}
        title={row.videoFile}
      >
        {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
      </div>
    )
  }
  if (ctx.preview === "recognize") {
    return ctx.previewStatus === "loading" ? (
      <span className="text-muted-foreground text-xs">
        <Spinner className="size-4" />
      </span>
    ) : (
      <span className="text-muted-foreground text-xs">
        {ctx.t("mediaFileTable.unrecognizedVideoFile", {
          defaultValue: "Cannot recognize video file",
        })}
      </span>
    )
  }
  return <span className="text-muted-foreground">-</span>
}

export function MediaFileTableEpisodeSimpleRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileDataRow
  index: number
}) {
  const isRowDisabled = row.disabled === true
  const rowKey = getMediaFileTableRowKey(row, index)

  const inner = (
    <MediaFileTableTr
      className={cn(isRowDisabled && "opacity-50")}
      onDoubleClick={ctx.onDoubleClick ? () => ctx.onDoubleClick?.(row) : undefined}
    >
      <MediaFileTableRowCells
        layout={ctx.columnLayout}
        idContent={`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}
        checkboxContent={
          <input
            type="checkbox"
            role="checkbox"
            className={cn(
              "h-3.5 w-3.5",
              isRowDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            checked={isRowDisabled ? false : ctx.isSelected(row)}
            disabled={isRowDisabled}
            onChange={(e) => {
              if (isRowDisabled) return
              ctx.onCheck?.(row, e.target.checked)
            }}
          />
        }
        videoContent={renderVideoContent(ctx, row, isRowDisabled)}
        thumbnailContent={<UICheckCell value={row.thumbnail} />}
        subtitleContent={<UICheckCell value={row.subtitle} />}
        nfoContent={<UICheckCell value={row.nfo} />}
      />
    </MediaFileTableTr>
  )

  return withContextMenu(
    rowKey,
    row,
    ctx.contextMenuConfig?.dataRowItems ?? [],
    inner,
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeSimpleRow.tsx
git commit -m "refactor(media): add MediaFileTableEpisodeSimpleRow component"
```

---

## Task 3: Create MediaFileTableEpisodeDetailRow

**Files:**
- Create: `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeDetailRow.tsx`

**Interfaces:**
- Consumes: `MediaFileTableRowContext`, `UIMediaFileDataRow` from `MediaFileTableRow.tsx`
- Produces: `MediaFileTableEpisodeDetailRow` component (renders `<tr>` with detail layout cells)

- [ ] **Step 1: Write MediaFileTableEpisodeDetailRow.tsx**

```typescript
import { cn } from "@/lib/utils"
import {
  MediaFileTableTr,
  MediaFileTableRowCells,
  withContextMenu,
  UICheckCell,
  UIThumbnailImage,
  getMediaFileTableRowKey,
  getDisplayPath,
  type MediaFileTableRowContext,
} from "../MediaFileTableRow"
import type { UIMediaFileDataRow } from "../UIMediaFileTable"

function renderVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): React.ReactNode {
  if (row.videoFile) {
    if (
      ctx.preview === "rename" &&
      row.newVideoFile &&
      row.videoFile !== row.newVideoFile
    ) {
      return (
        <div className="min-w-0 space-y-0.5">
          <div
            className="truncate text-muted-foreground/60 line-through text-xs"
            title={row.videoFile}
          >
            {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
          </div>
          <div className="truncate text-foreground font-medium" title={row.newVideoFile}>
            {getDisplayPath(row.newVideoFile, ctx.mediaFolderPath)}
          </div>
        </div>
      )
    }
    return (
      <div className="min-w-0 space-y-0.5">
        <div
          className="truncate font-medium text-foreground"
          title={row.episodeTitle || `${row.season}-${row.episode}`}
        >
          {row.episodeTitle ||
            `S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}` ||
            "-"}
        </div>
        <div
          className={cn(
            "truncate text-xs",
            isRowDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
          title={row.videoFile}
        >
          {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
        </div>
      </div>
    )
  }
  return <span className="text-muted-foreground">-</span>
}

function renderThumbnailContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
): React.ReactNode {
  return row.thumbnail ? (
    <UIThumbnailImage
      thumbnailPath={row.thumbnail}
      mediaFolderPath={ctx.mediaFolderPath}
      className="max-h-[72px] w-auto rounded object-contain"
    />
  ) : (
    <span className="text-muted-foreground text-xs">-</span>
  )
}

export function MediaFileTableEpisodeDetailRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileDataRow
  index: number
}) {
  const isRowDisabled = row.disabled === true
  const rowKey = getMediaFileTableRowKey(row, index)

  const inner = (
    <MediaFileTableTr
      className={cn(isRowDisabled && "opacity-50")}
      onDoubleClick={ctx.onDoubleClick ? () => ctx.onDoubleClick?.(row) : undefined}
    >
      <MediaFileTableRowCells
        layout={ctx.columnLayout}
        idContent={`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}
        checkboxContent={
          <input
            type="checkbox"
            role="checkbox"
            className={cn(
              "h-3.5 w-3.5",
              isRowDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            checked={isRowDisabled ? false : ctx.isSelected(row)}
            disabled={isRowDisabled}
            onChange={(e) => {
              if (isRowDisabled) return
              ctx.onCheck?.(row, e.target.checked)
            }}
          />
        }
        videoContent={renderVideoContent(ctx, row, isRowDisabled)}
        thumbnailContent={renderThumbnailContent(ctx, row)}
        subtitleContent={<UICheckCell value={row.subtitle} />}
        nfoContent={<UICheckCell value={row.nfo} />}
      />
    </MediaFileTableTr>
  )

  return withContextMenu(
    rowKey,
    row,
    ctx.contextMenuConfig?.dataRowItems ?? [],
    inner,
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/media/episodeRows/MediaFileTableEpisodeDetailRow.tsx
git commit -m "refactor(media): add MediaFileTableEpisodeDetailRow component"
```

---

## Task 4: Create MediaFileTableEpisodePreviewRow

**Files:**
- Create: `apps/ui/src/components/media/episodeRows/MediaFileTableEpisodePreviewRow.tsx`

**Interfaces:**
- Consumes: `MediaFileTableRowContext`, `UIMediaFileDataRow` from `MediaFileTableRow.tsx`
- Produces: `MediaFileTableEpisodePreviewRow` component (renders `<tr>` with preview layout cells)

- [ ] **Step 1: Write MediaFileTableEpisodePreviewRow.tsx**

```typescript
import { cn } from "@/lib/utils"
import {
  MediaFileTableTr,
  MediaFileTableRowCells,
  withContextMenu,
  UICheckCell,
  UIThumbnailImage,
  getMediaFileTableRowKey,
  getDisplayPath,
  type MediaFileTableRowContext,
} from "../MediaFileTableRow"
import type { UIMediaFileDataRow } from "../UIMediaFileTable"

function renderVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): React.ReactNode {
  return (
    <div className="min-w-0 space-y-2">
      <div
        className="truncate font-medium text-foreground"
        title={`${row.season}-${row.episode} ${row.episodeTitle || ""}`.trim()}
      >
        {`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}{" "}
        {row.episodeTitle ? `· ${row.episodeTitle}` : ""}
      </div>
      {row.videoFile ? (
        <>
          <div
            className={cn(
              "truncate text-xs",
              isRowDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
            title={row.videoFile}
          >
            {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
          </div>
          {!isRowDisabled && ctx.renderPreviewContent?.(row)}
        </>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      )}
    </div>
  )
}

function renderThumbnailContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
): React.ReactNode {
  return row.thumbnail ? (
    <UIThumbnailImage
      thumbnailPath={row.thumbnail}
      mediaFolderPath={ctx.mediaFolderPath}
      className="max-h-[140px] w-auto rounded object-contain"
    />
  ) : (
    <span className="text-muted-foreground text-xs">-</span>
  )
}

export function MediaFileTableEpisodePreviewRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileDataRow
  index: number
}) {
  const isRowDisabled = row.disabled === true
  const rowKey = getMediaFileTableRowKey(row, index)

  const inner = (
    <MediaFileTableTr
      className={cn(isRowDisabled && "opacity-50")}
      onDoubleClick={ctx.onDoubleClick ? () => ctx.onDoubleClick?.(row) : undefined}
    >
      <MediaFileTableRowCells
        layout={ctx.columnLayout}
        idContent={`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}
        checkboxContent={
          <input
            type="checkbox"
            role="checkbox"
            className={cn(
              "h-3.5 w-3.5",
              isRowDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            checked={isRowDisabled ? false : ctx.isSelected(row)}
            disabled={isRowDisabled}
            onChange={(e) => {
              if (isRowDisabled) return
              ctx.onCheck?.(row, e.target.checked)
            }}
          />
        }
        videoContent={renderVideoContent(ctx, row, isRowDisabled)}
        thumbnailContent={renderThumbnailContent(ctx, row)}
        subtitleContent={<UICheckCell value={row.subtitle} />}
        nfoContent={<UICheckCell value={row.nfo} />}
      />
    </MediaFileTableTr>
  )

  return withContextMenu(
    rowKey,
    row,
    ctx.contextMenuConfig?.dataRowItems ?? [],
    inner,
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/media/episodeRows/MediaFileTableEpisodePreviewRow.tsx
git commit -m "refactor(media): add MediaFileTableEpisodePreviewRow component"
```

---

## Task 5: Verify full build and run tests

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 2: Run UI tests**

```bash
pnpm test:ui
```

Expected: PASS (existing tests should still pass since `MediaFileTableEpisodeRow` is unchanged)

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "refactor(media): verify episode row layout split builds and passes tests"
```
