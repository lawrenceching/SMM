# MediaFileTable Component

从 `TvShowEpisodeTable` 提取并泛化的纯 UI 表格组件，供 MoviePanel / TvShowPanel / 未来其他 Panel 复用。

- [x] New UI component
- [ ] New user config
- [ ] Electron only
- [ ] User document

## 1. Background

当前 `TvShowEpisodeTable` 同时服务于 TvShowPanel（直接使用）和 MoviePanel（通过 adapter 适配），存在以下问题：

1. **语义错误**：MoviePanel 渲染名为 "TvShowEpisodeTable" 的组件
2. **耦合 API**：组件内部 import 了 `openFile`、`renameFiles`、`generateFfmpegScreenshots` 等 API，无法在纯 UI 环境（Storybook）中正常工作
3. **菜单硬编码**：右键菜单项通过 3 个独立 callback prop 控制，无法按行类型定制，无法添加新项
4. **不可扩展**：未来 MusicPanel 如需类似的文件表格，无法复用

## 2. Project Level Architecture

none — 仅 `apps/ui` 内部组件重构。

## 3. App Level Architecture

```
apps/ui/src/components/
  media/                              ← 新建
    MediaFileTable.tsx                ← 从 tv/TvShowEpisodeTable.tsx 提取 + 泛化
    MediaFileTable.stories.tsx        ← Storybook stories

  tv/
    TvShowEpisodeTable.tsx            ← 不变（后续迁移阶段改为重导出）

  movie/
    MoviePanel.tsx                    ← 不变（后续迁移阶段改引用）
  tv/
    TvShowPanel.tsx                   ← 不变（后续迁移阶段改引用）
```

## 4. User Stories

### 4.1 基本表格渲染

- **Given** 传入 `data: MediaFileTableRow[]`
- **When** 组件挂载
- **Then** 按行类型渲染 divider / folderFile / data 三种行，支持 simple/detail/preview 三种布局

### 4.2 右键菜单配置

- **Given** 传入 `contextMenuConfig`
- **When** 用户右键点击 data 行或 folderFile 行
- **Then** 显示 contextMenuConfig 中定义的菜单项，未配置的项不显示

### 4.3 布局切换

- **Given** 传入 `layout: "simple" | "detail" | "preview"`
- **When** prop 变化
- **Then** 表格立即切换布局（simple 紧凑行 / detail 缩略图+标题 / preview 大缩略图+截图）

### 4.4 预览模式 (Rename / Recognize)

- **Given** 传入 `preview="rename"` 或 `preview="recognize"`
- **When** 渲染 data 行
- **Then** rename 模式显示旧路径→新路径，recognize 模式显示加载状态或识别结果

### 4.5 Storybook 独立运行

- **Given** 组件不 import 任何业务 API
- **When** 在 Storybook 中渲染
- **Then** 所有交互由 mock callbacks 驱动，组件正常显示

## 5. Tasks

### 5.1 实现 MediaFileTable 组件

- [x] 创建 `apps/ui/src/components/media/MediaFileTable.tsx`
  - 类型定义：`MediaFileDividerRow`, `MediaFileDataRow`, `MediaFileFolderRow`, `MediaFileTableRow`, `FolderFileId`
  - 上下文菜单类型：`MediaFileDataContextMenuItem`, `MediaFileFolderContextMenuItem`, `MediaFileTableContextMenuConfig`
  - 组件 Props：`MediaFileTableProps`
  - 渲染逻辑：从 TvShowEpisodeTable 复制 + 适配
    - 保留：三种布局、列可见性切换（表头右键菜单）、可折叠 divider、缩略图 HoverCard
    - 移除：`openFile` / `renameFiles` API import、`onSelectFileContextMenuClick` / `onUnlinkContextMenuClick` / `onVideoCompressContextMenuClick` prop
    - 新增：`contextMenuConfig` prop
    - 截图功能：通过可选的 `renderPreviewContent` prop 注入，组件不再 import `generateFfmpegScreenshots`
  - 内部 helper：`CheckCell`, `getDisplayPath`, `getThumbnailImageUrl`, `ThumbnailImage`（保持私有）

- [x] 创建 `apps/ui/src/components/media/MediaFileTable.stories.tsx`
  - Stories:
    - Default (simple layout, movie-like data)
    - DetailLayout
    - PreviewLayout (无 renderPreviewContent — 纯 UI)
    - WithFolderFileRows (poster, fanart, nfo)
    - WithDivider (可折叠)
    - WithContextMenu (data 行自定义菜单项)
    - WithCheckboxes (preview 模式)
    - RenamePreview (新旧路径)
    - RecognizePreview (加载中)
    - Empty (空数据)
    - AllLayouts (所有布局并排对比)

### 5.2 验证

- [x] `pnpm run typecheck:ui` 通过
- [x] `pnpm run storybook` 能正常启动并查看所有 stories

## 6. Backward Compatibility

none — 本次仅新建组件，不修改任何现有文件。`TvShowEpisodeTable` 保持不变。

## 7. Documents

- [ ] `.agents/docs/design/media-file-table.md` — 本设计文档

## 8. Post Verification

- [x] Typecheck: `pnpm run typecheck:ui` 0 errors
- [x] Storybook: `pnpm run storybook` 正常渲染所有 stories
- [x] 现有测试不受影响: `pnpm test` 仍 1401 通过

---

## Appendix A: 接口定义

### 行类型

```typescript
export interface MediaFileDividerRow {
  id: string
  type: "divider"
  text: string
}

export interface MediaFileDataRow {
  season: number
  episode: number
  type: "episode"
  videoFile: string | undefined
  thumbnail: string | undefined
  subtitle: string | undefined
  nfo: string | undefined
  episodeTitle?: string
  newVideoFile?: string
  newThumbnail?: string
  newSubtitle?: string
  newNfo?: string
  checked: boolean
  disabled?: boolean
}

export type FolderFileId = "clearlogo" | "fanart" | "poster" | "theme" | "nfo"

export interface MediaFileFolderRow {
  id: FolderFileId
  type: "folderFile"
  path: string
}

export type MediaFileTableRow = MediaFileDividerRow | MediaFileDataRow | MediaFileFolderRow
```

### 上下文菜单

```typescript
export interface MediaFileDataContextMenuItem {
  id: string
  label: string
  /** falsy → 该项不渲染 */
  onClick?: (row: MediaFileDataRow) => void
  disabled?: boolean | ((row: MediaFileDataRow) => boolean)
}

export interface MediaFileFolderContextMenuItem {
  id: string
  label: string
  onClick?: (row: MediaFileFolderRow) => void
  disabled?: boolean | ((row: MediaFileFolderRow) => boolean)
}

export interface MediaFileTableContextMenuConfig {
  dataRowItems?: MediaFileDataContextMenuItem[]
  folderFileRowItems?: MediaFileFolderContextMenuItem[]
}
```

### 组件 Props

```typescript
interface MediaFileTableProps {
  data: MediaFileTableRow[]
  mediaFolderPath?: string
  /** 右键菜单配置。不传 → 所有行无右键菜单 */
  contextMenuConfig?: MediaFileTableContextMenuConfig
  /** 预览模式：rename(显示新旧路径) | recognize(显示识别状态) */
  preview?: "rename" | "recognize"
  previewStatus?: "loading" | "ok"
  /** 表格布局 */
  layout?: "simple" | "detail" | "preview"
  /** checkbox 勾选回调。不传 → 不显示 checkbox 列 */
  onCheck?: (row: MediaFileDataRow, checked: boolean) => void
  /** preview 布局下 data 行的附加内容（如视频截图）。不传 → 只显示路径和缩略图 */
  renderPreviewContent?: (row: MediaFileDataRow) => React.ReactNode
}
```

## Appendix B: Storybook Stories 清单

| Story | 描述 |
|-------|------|
| Default | simple 布局，含 divider + folderFile + data 行 |
| DetailLayout | detail 布局，含缩略图和集标题 |
| PreviewLayout | preview 布局，大缩略图 |
| WithFolderFiles | 展示 poster/fanart/nfo 三种 folderFile 行 + 右键菜单 |
| WithDividerCollapse | 可折叠 divider |
| WithContextMenu | data 行配置自定义右键菜单项 |
| WithCheckboxes | preview="rename" 模式，显示 checkbox 列 |
| RenamePreview | 显示新旧路径对比 |
| RecognizePreviewLoading | previewStatus="loading"，显示 spinner |
| Empty | 空数据 |
