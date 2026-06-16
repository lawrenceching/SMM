# MusicPanel Features

MusicPanel 的辅助功能设计：打开文件、摘要关联文件、下载进度条。

## 1. Open File

支持用户在 MusicPanel 中通过双击或右键→"打开"来打开音频文件和关联文件(字幕、封面、音频轨道、摘要)，使用 OS 默认应用。

### 1.1 Architecture

```
MusicFileTable (fileMenuForRow)
  → onOpen: openFile() API (而非 emitTrackOpenEvent)
  → LocalFileTableRow → UILocalFileTableRow
      ├── LocalFileRow: onDoubleClick → openFile
      └── AssociatedFileRow: onDoubleClick + 右键 "Open" → openFile
```

已有 `/api/openFile` 接口和 CLI 侧的 `openFile()` 工具函数 (shell.exec)。

### 1.2 Component Changes

| Component | Change |
|-----------|--------|
| `MusicFileTable.tsx` | `fileMenuForRow.onOpen` → `openFile()` API |
| `LocalFileRow.tsx` | Add `onDoubleClick` prop |
| `AssociatedFileRow.tsx` | Add `onOpen` prop + double-click + context menu "Open" |
| `UILocalFileTableRow.tsx` | Pass new props |
| `LocalFileTableRow.tsx` | Create `handleOpenAssociatedFile` callback |

## 2. Summary Associated File

在 MusicPanel 展开行中显示 AI 生成的摘要文件 (`{stem}_summary.txt`)。

### 2.1 Discovery

`useGetAssociatedFiles` hook 中的 `filterAssociatedFiles()`:

- **Before**: `.nfo` files → classified as `"summary"` (incorrect)
- **After**: `{stem}_summary*.txt` files → classified as `"summary"` (correct)

匹配模式:
- `song_summary.txt` ✓
- `song_summary_1.txt` ✓
- `song_summary_99.txt` ✓

### 2.2 Architecture

```
MusicPanel → MusicFileTable → LocalFileTableRow
  → useGetAssociatedFiles() → listFiles + filterAssociatedFiles()
  → AssociatedFileRow (renders "summary" type — already works)
```

`AssociatedFileRow` 已支持 `"summary"` 类型渲染，无需新增 UI 组件。

## 3. Job Row Download Progress Bar

在 MusicPanel 的下载任务行 (`JobTableRow`) 中实现进度条，整行背景作为进度条显示范围。

### 3.1 Data Flow

```
CLI command log (main.log)  ← 单一日志源
    ↑ TanStack Query (200ms poll)
useCommandLogQuery(executionId, isRunning)
    ↑
useYtdlpDownloadProgressQuery(executionId, isRunning)  ← 共享 hook
    ├── BackgroundJobItem (BackgroundJobsPopover)
    └── JobTableRow (MusicPanel)
```

两个组件共享同一个 TanStack Query cache（相同 `queryKey`），不会重复请求。

### 3.2 Component Changes

```
DownloadingTrack ← +executionId?: string
  → tracksFromDownloadJobRecords() → maps record.data.executionId
  → JobTableRowData → +executionId?: string
  → JobTableRow → useYtdlpDownloadProgressQuery({ executionId, isRunning })
      → liveProgress (percent / speedBps / etaSeconds)
      → 整行背景填充(绿色半透明) + speed/ETA text
```

### 3.3 Backward Compatibility

- `DownloadingTrack.executionId` 可选 — undefined 时回退到纯状态图标
- TanStack Query cache 共享自动，无需额外适配
