# MusicPanel 打开文件功能

支持用户在 MusicPanel 中通过双击或右键→"打开"来打开音频文件和关联文件(字幕、封面、音频轨道、摘要).

[x] New UI component - no new component, modify existing ones
[x] New user config - no
[x] Electron only - no, works via CLI's `openFile` API (shell.exec)
[x] User document - no

## 1. Background

当前 MusicPanel 中:
- **LocalFileRow**(音频文件行): 右键→"打开"调用 `emitTrackOpenEvent` 在媒体播放器中播放, 而不是用 OS 默认应用打开文件
- **AssociatedFileRow**(关联文件行: 字幕/封面/音频/摘要): 没有"打开"选项, 也没有双击支持

用户希望双击打开文件、右键→"打开"使用 OS 默认应用.

## 2. Project Level Architecture

无变更. 已有 `/api/openFile` 接口和 CLI 侧的 `openFile()` 工具函数 (shell.exec).

## 3. App Level Architecture

### 变更点

```
MusicFileTable (fileMenuForRow)
  │
  │ onOpen: emitTrackOpenEvent → openFile() API
  ▼
LocalFileTableRow
  │
  ▼
UILocalFileTableRow
  ├── LocalFileRow (音频文件行)
  │   └── onDoubleClick (新增 → openFile)
  └── AssociatedFileRow (关联文件行)
      ├── onDoubleClick (新增 → openFile)
      └── 右键菜单新增 "Open" 选项
```

### 组件变更明细

| 组件 | 变更 |
|------|------|
| `MusicFileTable.tsx` | `fileMenuForRow.onOpen` 改为调用 `openFile()` API |
| `LocalFileRow.tsx` | 新增 `onDoubleClick` prop + 处理 |
| `AssociatedFileRow.tsx` | 新增 `onOpen` prop + 双击处理 + 右键菜单 "Open" |
| `UILocalFileTableRow.tsx` | 传递新 props |
| `LocalFileTableRow.tsx` | 传递新 props |

## 4. User Stories

### 4.1 音频文件右键→打开

* **Given** - 用户在 MusicPanel 中查看音乐文件夹
* **When** - 右键点击音频文件行 → 选择 "Open"
* **Then** - OS 默认应用打开该音频文件

### 4.2 关联文件右键→打开

* **Given** - 用户在 MusicPanel 中展开音频文件行, 看到关联文件列表
* **When** - 右键点击关联文件行(字幕/封面/音频/摘要) → 选择 "Open"
* **Then** - OS 默认应用打开该关联文件

### 4.3 关联文件双击打开

* **Given** - 用户在 MusicPanel 中展开音频文件行, 看到关联文件列表
* **When** - 双击关联文件行
* **Then** - OS 默认应用打开该关联文件

## 5. Tasks

### 5.1 音频文件右键→打开 (LocalFileRow)

- [x] 5.1.1 `MusicFileTable.tsx`: `fileMenuForRow.onOpen` 改为调用 `openFile()` API
  - 使用 `absolutePosixMusicFilePath()` 解析绝对路径
  - 使用 `Path.toPlatformPath()` 转为平台路径
  - 调用 `openFile(platformPath)`
  - 删除 `emitTrackOpenEvent` 导入

### 5.2 关联文件行操作 (AssociatedFileRow)

- [x] 5.2.1 `AssociatedFileRow` 新增 `onOpen` prop 和 `onDoubleClick` 处理
- [x] 5.2.2 `AssociatedFileRow` 右键菜单新增 "Open" 选项 (非字幕文件)
- [x] 5.2.3 `AssociatedFileRow` 字幕文件: 右键菜单 "Open" 放在字幕菜单前

### 5.3 Props 传递链

- [x] 5.3.1 `LocalFileTableRow.tsx`: 创建 `handleOpenAssociatedFile` 回调 (resolve path + `openFile()`)
- [x] 5.3.2 `LocalFileTableRow.tsx` → `UILocalFileTableRow`: 传递 `onOpenAssociatedFile` callback
- [x] 5.3.3 `UILocalFileTableRow.tsx` → `AssociatedFileRow`: 传递 `onOpen` prop
- [x] 添加 `openError` i18n key 到所有 4 个语言

## 6. Backward Compatibility

- `LocalFileRow` 的单击行为保持不变(播放器中播放)
- 右键→"打开"行为变更: 从媒体播放器播放改为 OS 默认应用打开
- `AssociatedFileRow` 原有的字幕菜单保持不变, 新增 "Open" 选项在所有文件类型前

## 7. Documents

无文档变更.

## 8. Post Verification

- [x] 单元测试: 全部通过 (core: 217, ui: 953, cli: 188)
- [x] 构建: `pnpm run build` 成功
