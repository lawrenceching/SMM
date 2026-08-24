# Tests for Importing Folder

This page describes **e2e** test cases for [Import Folder](../import-folder.md).

Fixtures: `packages/test` (`folder1`, `folder2`, `tvShowFolder`, `movieFolder`, `musicFolder`, …).

Web UI and ohos share `apps/e2e/common/**`; ohos runs them with `--platform ohos`.

Directory recognition scenarios (TMDB/TVDB ID, NFO, search by name, unknown) are covered by unit tests in `apps/core/src/pipeline/recognizeMediaFolder.test.ts`, not listed here.

| Test Case | Platform | Test File |
|--|--|--|
| Import TV show — full pipeline | CLI | apps/cli/test/import-folder.e2e.ts |
| | Web UI | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts |
| | ohos | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts · apps/e2e/ohos/tv/TVShow-Import.e2e.ts |
| Import TV show — TMDB ID in folder name | CLI | apps/cli/test/import-folder.e2e.ts |
| | Web UI | apps/e2e/common/tv/TVShow-Import.e2e.ts |
| | ohos | apps/e2e/common/tv/TVShow-Import.e2e.ts · apps/e2e/ohos/tv/TVShow-Import.e2e.ts |
| Import TV show — TVDB ID in folder name | Web UI | apps/e2e/common/tv/InitializeTvShowByTvdb.e2e.ts |
| | ohos | apps/e2e/common/tv/InitializeTvShowByTvdb.e2e.ts |
| Import TV show — search by folder name (TVDB) | Web UI | apps/e2e/common/tv/InitializeTvShowByTvdb.e2e.ts |
| | ohos | apps/e2e/common/tv/InitializeTvShowByTvdb.e2e.ts |
| Import TV show — recognize from NFO | Web UI | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts · InitializeTvShowByTvdb.e2e.ts |
| | ohos | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts · InitializeTvShowByTvdb.e2e.ts |
| Import TV show — unknown / no match | Web UI | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts |
| | ohos | apps/e2e/common/tv/InitializeTvShowByTmdb.e2e.ts |
| Import TV show — batch media library | Web UI | apps/e2e/common/tv/ImportTvShowLibrary.e2e.ts |
| | ohos | apps/e2e/common/tv/ImportTvShowLibrary.e2e.ts |
| Import movie — full pipeline | CLI | apps/cli/test/import-folder.e2e.ts |
| | Web UI | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| Import movie — folder name search (TMDB) | Web UI | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| Import movie — TMDB ID in folder name | Web UI | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| Import movie — TVDB ID in folder name | Web UI | apps/e2e/common/movie/InitializeMovieByTvdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTvdb.e2e.ts |
| Import movie — search by folder name (TVDB) | Web UI | apps/e2e/common/movie/InitializeMovieByTvdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTvdb.e2e.ts |
| Import movie — recognize from NFO | Web UI | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| Import movie — unknown / no match | Web UI | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| | ohos | apps/e2e/common/movie/InitializeMovieByTmdb.e2e.ts |
| Import movie — batch media library | Web UI | apps/e2e/common/movie/ImportMovieLibrary.e2e.ts |
| | ohos | apps/e2e/common/movie/ImportMovieLibrary.e2e.ts |
| Import music | CLI | apps/cli/test/import-folder.e2e.ts |
| | Web UI | apps/e2e/common/other/App.e2e.ts |
| | ohos | apps/e2e/common/other/App.e2e.ts |
| Import music — tutorial fixture (manual) | Web UI | apps/e2e/common/manual/MusicPanel-Transcribe.e2e.ts |
| | ohos | apps/e2e/common/manual/MusicPanel-Transcribe.e2e.ts |
| Import with `--skip-init` | CLI | apps/cli/test/import-folder.e2e.ts |
| List imported folders | CLI | apps/cli/test/import-folder.e2e.ts |
| Remove imported folder (`smm rm`) | CLI | apps/cli/test/import-folder.e2e.ts |
| `smm show` / `smm metadata` after import | CLI | apps/cli/test/import-folder.e2e.ts |
| Switch UI among TV / movie / music folders | Web UI | apps/e2e/common/other/App.e2e.ts |
| | ohos | apps/e2e/common/other/App.e2e.ts |
| Import behind HTTP proxy | Web UI | apps/e2e/common/httpproxy/InitTvShowByTmdbBehindHttpProxy.e2e.ts · InitTvShowByTvdbBehindHttpProxy.e2e.ts |
| | ohos | apps/e2e/common/httpproxy/InitTvShowByTmdbBehindHttpProxy.e2e.ts · InitTvShowByTvdbBehindHttpProxy.e2e.ts |
| Import with custom TMDB / TVDB host | Web UI | apps/e2e/common/httpproxy/InitTvShowByCustomTmdbHost.e2e.ts · InitTvShowByCustomTvdbHost.e2e.ts |
| | ohos | apps/e2e/common/httpproxy/InitTvShowByCustomTmdbHost.e2e.ts · InitTvShowByCustomTvdbHost.e2e.ts |

## Coverage gaps

**CLI 有、Web UI / ohos 无 e2e：** `--skip-init`、`smm list`、`smm rm`、`smm show` / `metadata`。

**Web UI / ohos 有、CLI 无 e2e：** TVDB 识别、NFO 识别、Unknown 文件夹、批量导入媒体库、HTTP 代理与自定义 TMDB·TVDB host、UI 文件夹切换（`App.e2e.ts`）。其中识别路径已在 `recognizeMediaFolder.test.ts` 有单元覆盖；e2e 侧重 UI 与 pipeline 集成。

**Music：** CLI 有完整 e2e 断言；Web UI / ohos 主要在 `App.e2e.ts` 做 smoke。`RenameFolder.e2e.ts` 注明 `createAndImportFolderViaBrowser` 尚无法导入 music（TODO）。

**ohos：** movie / music / library 无单独 `apps/e2e/ohos/**` spec，依赖 `--platform ohos` 跑 `common/**`；设备侧导入步骤见 `apps/e2e/test/steps/import-folder-in-harmonyos.ts`。
