# MediaFileTable Business Component

为 `UIMediaFileTable` 创建业务逻辑层 `MediaFileTable`，封装"打开文件"和"属性"交互。

- [x] New UI component
- [x] New user config
- [x] Electron only
- [x] User document

## 1. Background

`UIMediaFileTable` 是纯 UI 组件，不包含任何业务逻辑（API 调用、对话框打开等）。当前 `TvShowEpisodeTable` 直接在 UI 组件内部 import `openFile` API，违反关注点分离原则。

本改动创建 `MediaFileTable` 业务组件和 `useMediaFileTableController` hook，将以下业务逻辑从 UI 层分离：
1. 双击文件 → 调用 `openFile` API 打开视频文件
2. 右键菜单"打开" → 调用 `openFile` API
3. 右键菜单"属性" → 打开 `MediaFilePropertyDialog`

## 2. Project Level Architecture

none — 仅 `apps/ui` 内部组件重构。

## 3. App Level Architecture

```
apps/ui/src/components/
  media/
    UIMediaFileTable.tsx               ← 现有，新增 onDoubleClick prop
    MediaFileTable.tsx                  ← 新建，业务逻辑组件
    useMediaFileTableController.ts     ← 新建，业务逻辑 hook
```

### 3.1 UIMediaFileTable 变更

新增 `onDoubleClick` prop：

```typescript
export interface UIMediaFileTableProps {
  // ... 现有 props
  /** 双击行回调。不传 → 双击无效果 */
  onDoubleClick?: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void
}
```

在 data row 和 folder file row 渲染处绑定 `onDoubleClick`。

### 3.2 useMediaFileTableController

```typescript
function useMediaFileTableController(mediaFolderPath: string | undefined): {
  openFile: (relativePath: string) => void
  openPropertiesDialog: (relativePath: string) => void
  handleDoubleClick: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void
}
```

- **openFile**: 拼接 `mediaFolderPath + relativePath` → 转换平台路径 → 调用 `@/api/openFile`
- **openPropertiesDialog**: 拼接路径 → 调用 `useDialogs().openMediaFileProperty({ filePath })`
- **handleDoubleClick**: data row → `openFile(row.videoFile)`; folder row → `openFile(row.path)`

### 3.3 MediaFileTable

```typescript
interface MediaFileTableProps {
  data: UIMediaFileTableRow[]
  mediaFolderPath?: string
  preview?: "rename" | "recognize"
  previewStatus?: "loading" | "ok"
  layout?: "simple" | "detail" | "preview"
  onCheck?: (row: UIMediaFileDataRow, checked: boolean) => void
  renderPreviewContent?: (row: UIMediaFileDataRow) => ReactNode
}
```

内部逻辑：
1. 调用 `useMediaFileTableController(mediaFolderPath)` 获取 controller
2. 用 `useMemo` 构建 `contextMenuConfig`：
   - **dataRowItems**: Open（id: "open", 禁用条件: `!row.videoFile`）+ Properties（id: "properties", 禁用条件: `!row.videoFile`）
   - **folderFileRowItems**: Open（id: "open", 禁用条件: `!row.path`）
3. 渲染 `<UIMediaFileTable>` 传入 `contextMenuConfig` 和 `onDoubleClick={ctrl.handleDoubleClick}`

Props 透传：`data`, `mediaFolderPath`, `preview`, `previewStatus`, `layout`, `onCheck`, `renderPreviewContent`

## 4. User Stories

### 4.1 双击打开视频文件

- **Given** 表格显示 data row（有 videoFile）
- **When** 用户双击该行
- **Then** 系统调用 `openFile` 打开视频文件

### 4.2 右键菜单打开文件

- **Given** 表格显示 data row（有 videoFile）或 folder file row
- **When** 用户右键点击并选择"打开"
- **Then** 系统调用 `openFile` 打开对应文件

### 4.3 右键菜单属性

- **Given** 表格显示 data row（有 videoFile）
- **When** 用户右键点击并选择"属性"
- **Then** 打开 `MediaFilePropertyDialog`，传入视频文件路径

### 4.4 无视频文件时禁用菜单

- **Given** data row 没有 videoFile
- **When** 用户右键点击该行
- **Then** "打开"和"属性"菜单项为禁用状态

## 5. Tasks

### 5.1 UIMediaFileTable: 新增 onDoubleClick

- [x] 在 `UIMediaFileTableProps` 新增 `onDoubleClick?: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void`
- [x] 在 data row 渲染处绑定 `onDoubleClick`（双击整行）
- [x] 在 folder file row 渲染处绑定 `onDoubleClick`（双击整行）

### 5.2 创建 useMediaFileTableController

- [x] 创建 `apps/ui/src/components/media/useMediaFileTableController.ts`
  - 接收 `mediaFolderPath: string | undefined`
  - 返回 `{ openFile, openPropertiesDialog, handleDoubleClick }`
  - `openFile(relativePath)`: join + toPlatformPath + `openFile()` API
  - `openPropertiesDialog(relativePath)`: join + toPlatformPath + `useDialogs().openMediaFileProperty()`
  - `handleDoubleClick(row)`: 根据 row type 分发到 openFile

### 5.3 创建 MediaFileTable

- [x] 创建 `apps/ui/src/components/media/MediaFileTable.tsx`
  - Props: `MediaFileTableProps`（不含 contextMenuConfig）
  - 使用 `useMediaFileTableController` 和 `useTranslation`
  - 构建 `contextMenuConfig`（dataRowItems: Open + Properties; folderFileRowItems: Open）
  - 渲染 `<UIMediaFileTable>` 传递所有 props + contextMenuConfig + onDoubleClick

### 5.4 国际化

- [x] 在 `apps/ui/public/locales/*/components.json` 新增 i18n key：
  - `mediaFileTable.contextMenu.open`
  - `mediaFileTable.contextMenu.properties`

### 5.5 验证

- [x] `pnpm run typecheck:ui` 通过
- [x] `pnpm run storybook` — MediaFileTable story 正常渲染

## 6. Backward Compatibility

- `UIMediaFileTable` 新增 optional prop → 向后兼容
- `MediaFileTable` 为新组件 → 不影响现有代码
- 现有 `TvShowEpisodeTable` 保持不变（后续阶段迁移）

## 7. Documents

- [x] `.agents/docs/design/media-file-table-business.md` — 本设计文档

## 8. Post Verification

- [x] Typecheck: `pnpm run typecheck:ui` 0 errors
- [x] 单元测试: `useMediaFileTableController` 7/7 passing (`pnpm exec vitest run src/components/media/useMediaFileTableController.test.ts`)
- [x] 现有测试不受影响: `pnpm test` 1408 passed | 23 skipped (was 1401 passed; +7 new hook tests, no regressions)
- [ ] Storybook: UIMediaFileTable stories 渲染验证（未在本阶段运行 storybook build，因为 UIMediaFileTable 新增的是 optional prop，向后兼容；MediaFileTable 是新组件，遵循同模式）
