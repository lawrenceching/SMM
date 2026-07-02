# MediaMetadata 更新逻辑代码链路

本文梳理 `MediaMetadata` 的更新流程，覆盖两条主路径：

1. 导入多媒体目录时的初始化
2. 用户手动搜索并选择媒体结果

## App 启动与导入概览

`ui/src/AppInitializer.tsx`:
1. 加载 `userConfig`
2. 将 `userConfig.folders` 转换为 `UIMediaMetadata`

**Backend 侧 UserConfig 变更**: `userConfig.folders` 可能被以下来源修改：
- AI Assistant
- MCP Tool（外部 AI Assistant）

变更时 backend broadcast `userConfigUpdate` 事件（`cli/src/events/userConfigUpdatedEvent.ts`），UI 接收后刷新文件夹列表。

---

## 1. 导入多媒体目录初始化链路

入口文件：`apps/ui/src/components/eventlisteners/MediaFolderImportedEventHandler.tsx`

### 1.1 事件入口与 optimistic 占位

- 监听 `UI_MediaFolderImportedEvent`
- 进入 `doInitializeMediaFolder(event)`
- 先做 optimistic 更新：
  - `createMediaMetadata(...)` 创建占位对象
  - `status: 'initializing'`
  - 写入 `useMediaMetadataStore` 并切换选中目录

### 1.2 初始化 metadata（未识别阶段）

调用链：

- `MediaFolderImportedEventHandler`
  - `initializeMediaMetadata(folderPathInPlatformFormat, mediaType, { traceId })`
- `apps/ui/src/actions/mediaMetadataActions.ts`
  - `useMediaMetadataActions().initializeMediaMetadata(...)`
- `apps/ui/src/api/mediaMetadataRepository.ts`
  - `mediaMetadataRepository.initialize(...)`

初始化逻辑：

- 先尝试 `read(...)` 读取缓存 metadata
- 如果不存在，调用 `listFiles(...)` 扫描目录文件
- 构造初始 `UIMediaMetadata`：
  - `mediaFolderPath`
  - `type` (`tvshow-folder` / `movie-folder`)
  - `files`
  - `mediaFiles: []`
  - `status: 'initializing'`

### 1.3 预处理识别（识别媒体身份 + 本地文件关联）

在初始化结果不完整（`tvShow` 和 `movie` 都为空）时进入：

- `doPreprocessMediaFolder(initializedMetadata, options)`
  - 文件：`apps/ui/src/AppV2Utils.ts`

内部流程：

1. `recognizeMediaFolder(...)` 识别媒体身份（TMDB / TVDB）
2. 按媒体类型识别媒体文件：
   - 电视剧：`recognizeEpisodesAsync(mm)`，写回 `mediaFiles`（season/episode）
   - 电影：`recognizeMovieMediaFiles(mm)`，写回 `mediaFiles`
3. 回调 `onSuccess(mm)`，最终 `updateMediaMetadata(..., { status: 'ok' })`

### 1.4 recognizeMediaFolder 的识别顺序（核心）

文件：`apps/ui/src/lib/recognizeMediaFolder.ts`

固定顺序：

1. NFO 识别：`tryToRecognizeMediaFolderByNFO`
2. 文件夹名中的 `tmdbid=`：`tryToRecognizeMediaFolderByTmdbIdInFolderName`
3. 文件夹名中的 `tvdbid=`：`tryToRecognizeMediaFolderByTvdbIdInFolderName`
4. 文件夹名搜索（TMDB/TVDB 顺序由 `primaryDatabase` 决定）
   - `primaryDatabase === "TVDB"`：TVDB -> TMDB
   - 其他情况（含未配置）：TMDB -> TVDB

### 1.5 电视剧 / 电影 + TMDB / TVDB 分流细节

#### 电视剧目录（`tvshow-folder`）

- TMDB：
  - 通过 `useGetTmdbTvShowMutation` 获取剧集详情
  - mutation 内部调用：
    - `useTmdbQueries().getTvShowById(...)`
    - `useTmdbQueries().getTvShowSeasonDetails(...)`
  - 最终构建 `TvShowMediaMetadata`

- TVDB：
  - 通过 `useGetTvdbTvShowMutation` 调 `useTvdbQueries().getTvShowMediaMetadata(...)`
  - 底层使用 `fetchTvdbAndBuildTvShowMediaMetadata(...)`
  - 返回含 seasons/episodes 的 `TvShowMediaMetadata`

#### 电影目录（`movie-folder`）

- TMDB：
  - 文件夹名搜索命中后，生成 `MovieMediaMetadata`

- TVDB：
  - 可通过 `tvdbid=` 或文件夹名搜索命中
  - 调 `fetchTvdbAndBuildMovieMediaMetadata(...)` 构建 `MovieMediaMetadata`

---

## 2. 手动搜索并选择结果链路

入口文件：
- `apps/ui/src/components/TvShowPanel.tsx`
- `apps/ui/src/components/MoviePanel.tsx`

上游搜索框文件：
- `apps/ui/src/components/MediaDatabaseSearchbox.tsx`

### 2.1 搜索框到面板回调

`MediaDatabaseSearchbox` 根据当前数据库执行搜索：

- TMDB：`searchTmdb(...)`
- TVDB：`new TVDBv4(...).search(...)`

用户点选后统一回调：

- `onSearchResultSelected({ database, result, searchLanguage })`

由 `TvShowHeaderV2` / `MovieHeaderV2` 传到对应 panel 的 `handleSelectResult`

### 2.2 电视剧手动选择链路

文件：`apps/ui/src/components/TvShowPanel.tsx`

函数：`handleSelectResult(args)`

#### TVDB 分支

- 从 `result.tvdb_id` 解析 `seriesId`
- 调 `fetchTvdbAndBuildTvShowMediaMetadata(seriesId, searchLanguage, callbacks)`
- 状态流转：
  - 先 `updateMediaMetadata(..., { status: 'updating' })`
  - 成功后写入：
    - `tvShow = tvdbTvShow`
    - `tmdbTvShow = undefined`
    - `status = 'ok'`

#### TMDB 分支

- 调 `applyTmdbTvShowSelectionMutation.mutate(...)`
- 该 mutation 来自 `useGetTmdbTvShowMutation`
- 状态流转：
  - `onMutate`: `status = 'updating'`
  - `onSuccess`: 写入 `tvShow`，`status = 'ok'`
  - `onError`: `status = 'error_loading_metadata'`

### 2.3 电影手动选择链路

文件：`apps/ui/src/components/MoviePanel.tsx`

函数：`handleSelectResult(args)`

#### TVDB 分支

- 调 `useGetTvdbMovieMutation().mutate({ movieId, language }, callbacks)`
- 状态流转：
  - 先 `status = 'updating'`
  - `onSuccess`: 写入 `movie`，`status = 'ok'`
  - `onError`: toast 报错，状态恢复为 `ok`

#### TMDB 分支

- 调 `useGetTmdbMovieMutation().mutate({ id, language }, callbacks)`
- 状态流转：
  - 先 `status = 'updating'`
  - `onSuccess`: 写入 `movie`，`status = 'ok'`
  - `onError`: toast 报错，状态恢复为 `ok`

---

## 3. 持久化规则：什么时候会写磁盘

关键文件：`apps/ui/src/actions/mediaMetadataActions.ts`

所有核心更新都经过：

- `useMediaMetadataActions().updateMediaMetadata(path, updaterOrMetadata, options)`

判定规则：

- 调 `hasDomainMetadataChanged(current, updated)` 判断是否是领域数据变化
- 如果只改 UI 字段（例如 `status`）：
  - 只更新 zustand store，不持久化
- 如果领域字段变化（如 `tvShow` / `movie` / `mediaFiles` / `type`）：
  - 调 `mediaMetadataRepository.write(...)` 落盘
  - 再更新 store

补充：

- 写盘函数 `writeMediaMetadata(...)` 当前会将 `files` 清空后写入缓存（`dst.files = []`）

---

## 4. 调用链速查

### 导入初始化

`MediaFolderImportedEventHandler.doInitializeMediaFolder`
-> `initializeMediaMetadata`
-> `mediaMetadataRepository.initialize`
-> `doPreprocessMediaFolder`
-> `recognizeMediaFolder`
-> (NFO -> tmdbid -> tvdbid -> folder name search)
-> 电视剧 `recognizeEpisodesAsync` / 电影 `recognizeMovieMediaFiles`
-> `updateMediaMetadata(status: ok)`

### 手动选择（电视剧）

`MediaDatabaseSearchbox.onSelect`
-> `TvShowPanel.handleSelectResult`
-> TVDB: `fetchTvdbAndBuildTvShowMediaMetadata`
-> TMDB: `useGetTmdbTvShowMutation`
-> `updateMediaMetadata(tvShow, status)`

### 手动选择（电影）

`MediaDatabaseSearchbox.onSelect`
-> `MoviePanel.handleSelectResult`
-> TVDB: `useGetTvdbMovieMutation`
-> TMDB: `useGetTmdbMovieMutation`
-> `updateMediaMetadata(movie, status)`

