# MoviePanel 视频文件行不显示关联文件

## Background

`MoviePanel` 在功能探索阶段引入了 `isUseMediaFileTableEnabled` 特性开关（`useFeatures`），启用后渲染新增的 `<MediaFileTable>`（基于 `UIMediaFileTable`），未启用时仍使用复用自 `TvShowPanel` 的 `<TvShowEpisodeTable>`（见 `.agents/docs/design/movie-panel-reuse-tv-table.md`）。

两个分支最终都会调用同一个适配器 `buildMovieEpisodeTableRows`（`apps/ui/src/lib/buildMovieEpisodeTableRows.ts`），把 movie 类型的 `MediaMetadata` 适配成 "S01E01 单集" 的 `TvShowEpisodeTableRow[]`，交给表格组件渲染。

用户反馈：MoviePanel 中**视频文件行（episode row）的 thumbnail / subtitle / nfo 列都为空**（勾选标记为 `MinusIcon`，表示无关联）。电影目录里只有 `poster.*` / `fanart.*` / `movie.nfo` 三类 folder-level 资产，没有与视频同 stem 的 `*.srt` / `*.nfo`。

## Goal

排查 MoviePanel 视频文件行不显示关联文件列的原因：定位是 `buildMovieEpisodeTableRows` 适配器未产出关联文件路径，还是 `MediaFileTable` / `TvShowEpisodeTable` 渲染层未读取数据，抑或 column visibility 默认隐藏。

预期行为（参照 TvShowPanel）：视频行能正确反映已识别的关联文件（subtitle / nfo / poster），即便电影目录下没有 stem-matched 的关联文件，也应该把 folder-level 的 `poster.jpg` / `movie.nfo` 关联到行内对应列，或至少呈现合理状态。

## Code Flow

### 1. MoviePanel 数据装配

`apps/ui/src/components/movie/MoviePanel.tsx`：

- `useMediaMetadataQuery(selectedFolder)` 拉取后端 metadata（TanStack Query，缓存键基于 POSIX path）。
- `mediaMetadata` 经 `findMediaFilesForMovieMediaMetadata` (`apps/ui/src/helpers/movie/MovieMediaMetadataUtils.ts`) 加工：扫描 `mm.files`，按 `videoFileExtensions` 过滤出视频文件，构造 `mm.mediaFiles = [{ absolutePath }]`（注意 Movie 不带 `seasonNumber/episodeNumber`，与 TvShow 不同）。
- 同步触发 `buildMovieFilesFromMediaMetadata` (`apps/ui/src/helpers/movie/buildMovieFilesFromMediaMetadata.ts`) 维护 `movieFiles` 状态，供 `RuleBasedRenameFilePrompt` 重命名预览使用。
- 表格数据 `tableData` 由 `buildMovieEpisodeTableRows(mediaMetadata, folderStatus, t, { renamePreview })` 生成（`apps/ui/src/lib/buildMovieEpisodeTableRows.ts`）。

### 2. buildMovieEpisodeTableRows 适配器

`apps/ui/src/lib/buildMovieEpisodeTableRows.ts`：

1. 短路空态：`initializing` / `folder_not_found` / `error_loading_metadata` / 无 video 文件 → 返回单个 divider。
2. Folder-level 行：扫描 `mm.files`，**仅**把以 `poster.` / `fanart.` 开头的文件和名为 `movie.nfo` 的文件作为 `folderFile` 行（参考 `apps/ui/src/lib/buildTvShowEpisodeTableRows.ts:31-42` 的 `buildFolderFileRows`，但 ID 集合更窄，只支持 `poster/fanart/nfo`，不支持 `clearlogo/theme`）。
3. 推一个 `divider: { id: "movie", text: "Movie" }`，对应 `_buildTvShowEpisodeTableRowsFromTmdb` 中的 season divider。
4. 关键步骤：从 `mm.mediaFiles[0]` 取出 `videoFile.absolutePath`，调用 `findAssociatedFiles(mediaFolderPath, mm.files, videoFile.absolutePath)` 检索关联文件：
   - `findAssociatedFiles` (`apps/ui/src/lib/utils.ts:80-118`) 用 **严格 stem 匹配**：
     - 取 `videoFilePath` 的 basename → 去扩展名 → `filenameWithoutExtension`
     - 候选名 = `${filenameWithoutExtension}.srt` / `${filenameWithoutExtension}.zh-CN.srt` / `${filenameWithoutExtension}.jpg` 等
     - 必须以 `{stem}.` 开头并以已知扩展名结尾
   - 返回 `[POSTER, SUB, AUD, NFO]` 列表
5. 把第一个 `POSTER` → `row.thumbnail`、第一个 `SUB` → `row.subtitle`、第一个 `NFO` → `row.nfo`。
6. `subtitle` 兜底：若 `findAssociatedFiles` 没找到，且 `videoFile.subtitleFilePaths[0]` 存在，则使用之（仅 subtitle 有此兜底，thumbnail / nfo 没有）。
7. 推一条 `TvShowEpisodeDataRow`（`season=1, episode=1, videoFile, thumbnail, subtitle, nfo, episodeTitle=movie.name`）。

**问题点 A**：`findAssociatedFiles` 只匹配与视频文件 stem 一致的关联文件。用户的目录是 `Movie (2024).mkv` + `Movie.srt` + `poster.jpg` + `movie.nfo`，因为字幕 stem 不匹配，subtitle 拿不到（且用户也无 stem-matched 字幕）；poster 作为 folder-level 行被识别，但 episode row 的 `thumbnail` 仍为 `undefined`，因为 `findAssociatedFiles` 没有命中任何 `Movie (2024).*`。

**问题点 B**：TvShow adapter (`buildTvShowEpisodeTableRows`) 走相同的 `findAssociatedFiles` 路径，但 TvShow 每集视频文件名（如 `S01E01.mkv`）通常与字幕 / NFO stem 一致（如 `S01E01.srt`、`S01E01.nfo`），所以 TvShowPanel 正常显示。Movie 命名场景天然更松散 → stem 匹配经常失败。

### 3. 表格组件渲染

两套组件共用同一份 row schema：

#### 3a. `<TvShowEpisodeTable>`（feature flag 关闭分支）

`apps/ui/src/components/tv/TvShowEpisodeTable.tsx`：

- Props 类型 `TvShowEpisodeTableRow = DividerRow | DataRow | FolderFileRow`（与适配器输出兼容）。
- DataRow 直接渲染 `thumbnail` / `subtitle` / `nfo` 三列，使用 `<CheckCell value={...}/>`：`value !== undefined` 时显示绿色 CheckIcon，否则 MinusIcon。
- FolderFileRow 把 `poster` / `fanart` / `movie.nfo` 渲染为独立行，仅在 video 列展示 path。

#### 3b. `<MediaFileTable>`（feature flag 启用分支）

`apps/ui/src/components/media/MediaFileTable.tsx` + `UIMediaFileTable.tsx`：

- 同样的行 schema（`UIMediaFileTableRow` 类型在 `UIMediaFileTable.tsx:90`，与 `TvShowEpisodeTableRow` 形状一致）。
- `<MediaFileTableRowCells>` (`mediaFileTableColumns.tsx:80-131`) 渲染 episode 行的 thumbnail / subtitle / nfo 三列。
- DataRow 的 subtitle/nfo 用 `<UICheckCell>` (`MediaFileTableRow.tsx:95-108`)：value 非 undefined → CheckIcon，undefined → MinusIcon。
- 详情布局（detail / preview）下 thumbnail 列显示真实缩略图（`UIThumbnailImage` + HoverCard）；simple 布局下 thumbnail 列也走 `<UICheckCell>`。
- Column visibility：默认 `defaultColumnVisibility = { video: true, thumbnail: true, subtitle: true, nfo: true }`（`UIMediaFileTable.tsx:179-184`）。用户可以通过表头右键菜单切换列显隐，状态保存在 `UIMediaFileTable` 的 `columnVisibility` state 中。

**问题点 C**：`<MediaFileTable>` / `<UIMediaFileTable>` 内部维护 `columnVisibility` 状态。如果 MoviePanel 切换 feature flag 时多次创建/销毁组件实例，状态不持久化，但不会把列隐藏成"看不到"——默认就是全显示。

### 4. MoviePanel 渲染分支

`MoviePanel.tsx:349-369`：

```tsx
{folderStatus === "initializing" ? (
  <MediaPanelInitializingHint />
) : isUseMediaFileTableEnabled ? (
  <MediaFileTable
    key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
    data={tableData as UIMediaFileTableRow[]}
    mediaFolderPath={mediaMetadata?.mediaFolderPath}
    layout={isPreviewingForRename ? "simple" : layout}
    preview={isPreviewingForRename ? "rename" : undefined}
  />
) : (
  <TvShowEpisodeTable
    key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
    data={tableData}
    mediaFolderPath={mediaMetadata?.mediaFolderPath}
    layout={isPreviewingForRename ? "simple" : layout}
    preview={isPreviewingForRename ? "rename" : undefined}
    onVideoCompressContextMenuClick={isVideoCompressionEnabled ? handleVideoCompressClick : undefined}
  />
)}
```

`tableData` 通过 `tableData as UIMediaFileTableRow[]` 断言后传入两个分支。`TvShowEpisodeTableRow` 与 `UIMediaFileTableRow` 结构兼容（divider / episode / folderFile），所以类型断言是合理的。

### 5. 数据来源对照（媒体识别阶段）

`MediaFileMetadata` (`packages/core/types.ts:506-530`)：
- `absolutePath: string`
- `seasonNumber? / episodeNumber?`（仅 TV show）
- `subtitleFilePaths?: string[]`（识别后由后端填充）
- `audioFilePaths?: string[]`
- ❌ **没有** `thumbnailFilePaths` 字段

后端识别（movie 流程）只会把 `subtitleFilePaths` / `audioFilePaths` 写回 `mediaFiles[i]`，封面 / NFO 仍依赖前端 `findAssociatedFiles` 扫描 `mm.files`。

## Files to Investigate

| 文件 | 关注点 |
|---|---|
| `apps/ui/src/lib/buildMovieEpisodeTableRows.ts` | `findAssociatedFiles` 调用、subtitle 兜底、thumbnail/nfo 无兜底 |
| `apps/ui/src/lib/utils.ts:80-118` | `findAssociatedFiles` 的 stem 匹配逻辑；movie 命名场景天然不命中 |
| `apps/ui/src/lib/buildTvShowEpisodeTableRows.ts:90-168` | TV show adapter 同问题对照，是否有更宽松的兜底 |
| `apps/ui/src/components/movie/MoviePanel.tsx:313-318` | `tableData` 是否被正确传入 |
| `apps/ui/src/components/media/MediaFileTable.tsx` / `UIMediaFileTable.tsx` | column visibility 默认值与渲染分支 |
| `apps/ui/src/components/tv/TvShowEpisodeTable.tsx` | 与 MediaFileTable 对照，确认 TvShowEpisodeTable 渲染没有遗漏 |
| `apps/ui/src/hooks/useFeatures.ts` | `isUseMediaFileTableEnabled` 默认值与持久化（用户当前分支） |
| `apps/ui/src/helpers/movie/MovieMediaMetadataUtils.ts` | 确认 `mediaFiles` 是否被正确填入（必要前提） |

## Reproduction Hints

最小复现场景（与用户描述一致）：
- 文件夹路径：`<movie folder>/`
- 文件清单：
  - `<movie folder>/Movie (2024).mkv`（video）
  - `<movie folder>/poster.jpg`
  - `<movie folder>/fanart.jpg`
  - `<movie folder>/movie.nfo`
- 期望：episode row 的 `thumbnail` 列显示 poster（无论作为缩略图或勾标记）；folder-level `poster` / `fanart` / `movie.nfo` 三行独立渲染；`subtitle` / `nfo` 列因不存在可为空。
- 实际：episode row 的 `thumbnail / subtitle / nfo` 全空（MinusIcon）。

可补充复现场景：
- 同目录额外有 `Movie.srt`（与视频 stem 不同）→ 仍应进入 subtitle 列，但当前实现会漏掉，因为 stem 匹配不命中，且 `mediaFileMetadata.subtitleFilePaths` 仅在识别阶段由后端填入。
- 同目录额外有 `Movie (2024).srt` → 应进入 subtitle 列（命中 stem 匹配），当前实现能正确显示。
