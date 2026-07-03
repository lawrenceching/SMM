# Media Folder Initialization — Code Flow

## 1. Overview

"Media Folder Initialization" is the full pipeline that recognizes a newly imported media folder. It has 3 entry points and goes through **event dispatch → mutex → state update → metadata initialization → content recognition → persistence**.

## 2. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Entry Points (Triggers)                        │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │ A. Toolbar menu      │  │ B. Drag & drop       │  │ C. Media library     │
  │ AppV2.tsx            │  │ DragDropReceiver.tsx │  │ import               │
  │ handleOpenFolder-    │  │ openOpenFolder(...)  │  │ MediaLibraryImported-│
  │ MenuClick            │  │                      │  │ EventHandler.tsx     │
  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘
             │                         │                         │
             │   openNativeFolderDialog/openFilePicker           │
             │                         │                         │
             │   selectedFile.path     │   folderPath            │   listLibraryFolders()
             │                         │                         │   ──> for each sub-folder
             │                         │                         │
             └─────────────────────────┼─────────────────────────┘
                                       │
                                       ▼
              ┌──────────────────────────────────────────────────┐
              │  document.dispatchEvent(UI_MediaFolderImported)  │
              │  detail: { type, folderPathInPlatformFormat,    │
              │           traceId, skipOptimisticUpdate?,       │
              │           onCompleted? }                        │
              └──────────────────────┬───────────────────────────┘
                                     │
                                     ▼

┌─────────────────────────────────────────────────────────────────────────┐
│               Event Listener (main.tsx > EventListeners)                │
│  MediaFolderImportedEventHandler.tsx                                    │
│  ─ useMount() registers document.addEventListener                       │
└─────────────────────────────────────────────────────────────────────────┘

                                     │
                                     ▼

              ┌──────────────────────────────────────────────────┐
              │  mutex.acquire()  ← es-toolkit Mutex (serialize) │
              │  Guarantees only one folder is initialized       │
              │  at a time, preventing race conditions           │
              └──────────────────────┬───────────────────────────┘
                                     │
                                     ▼

┌─────────────────────────────────────────────────────────────────────────┐
│       useInitializeImportedMediaFolder.ts → initializeImportedMediaFolder│
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Phase 1: onStart(folder, type)                                      │ │
│  │   ├─ useJobManager.addJob(`初始化 ${folder.name}`)                  │ │
│  │   ├─ updateJob(_jobId, { status: 'running', progress: 50 })         │ │
│  │   ├─ upsertFolder({ path, status: 'initializing', type })          │ │
│  │   │     ↑ useUIMediaFolderStore (Zustand)                          │ │
│  │   └─ If NOT Library import: setSelectedFolder(folder)              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                     │                                    │
│                                     ▼                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Phase 2: doInitialization() (60s timeout via withTimeout)           │ │
│  │                                                                     │ │
│  │  ① addMediaFolderInUserConfig(traceId, folder)                     │ │
│  │     └─ useAddMediaFolderMutation                                    │ │
│  │        ├─ Read smm.json (TanStack cache / writeFile)                │ │
│  │        ├─ folders = [...new Set([...prev, folder])]                │ │
│  │        └─ writeFile(smm.json, JSON.stringify(config))              │ │
│  │                                                                     │ │
│  │  ② initializeMediaMetadata({ folderPathInPlatformFormat, type })   │ │
│  │     └─ useInitializeMediaMetadataMutation                          │ │
│  │        ├─ mm = { mediaFolderPath, type, files: [], mediaFiles: [] } │ │
│  │        ├─ POST /api/listFiles { path, recursively, onlyFiles }     │ │
│  │        └─ mm.files = items.map(Path.posix)                         │ │
│  │                                                                     │ │
│  │  ③ saveMediaMetadata(folder, mm)  ── Persist initial empty metadata │ │
│  │     └─ useUpdateMediaMetadataMutation                              │ │
│  │        └─ mediaMetadataRepository.write(mm)                        │ │
│  │                                                                     │ │
│  │  ④ Branch on type:                                                  │ │
│  │     ┌─────────────────────────────────────────────────────────────┐ │ │
│  │     │ tvshow:                                                    │ │ │
│  │     │   ┌─ Stage 1: recognizeTvShow(mm)  [Identify the show]    │ │ │
│  │     │   │   runRecognitionSteps(traceId, tvSteps)                │ │ │
│  │     │   │   ┌────────────────────────────────────────────────┐   │ │ │
│  │     │   │   │ 1) recognizeTvShowByNfo                       │   │ │ │
│  │     │   │   │    → Read tvshow.nfo, parse tmdbid/tvdbid     │   │ │ │
│  │     │   │   │    → useGetTmdbTvShowMutation / Tvdb          │   │ │ │
│  │     │   │   ├────────────────────────────────────────────────┤   │ │ │
│  │     │   │   │ 2) recognizeTvShowByTmdbIdInFolderName        │   │ │ │
│  │     │   │   │    → Regex extract tmdb-{id} from folder name │   │ │ │
│  │     │   │   ├────────────────────────────────────────────────┤   │ │ │
│  │     │   │   │ 3) recognizeTvShowByTvdbIdInFolderName        │   │ │ │
│  │     │   │   │    → Extract tvdbid-{id} format               │   │ │ │
│  │     │   │   ├────────────────────────────────────────────────┤   │ │ │
│  │     │   │   │ 4) searchOrderForPrimaryDb(primaryDatabase)  │   │ │ │
│  │     │   │   │    Default [TMDB, TVDB]; reverse for TVDB    │   │ │ │
│  │     │   │   │    4a) Search folder name in TMDB            │   │ │ │
│  │     │   │   │    4b) Search folder name in TVDB            │   │ │ │
│  │     │   │   └────────────────────────────────────────────────┘   │ │ │
│  │     │   │   First step returning non-undefined terminates       │ │ │
│  │     │   │   (HIT/MISS logged with traceId)                       │ │ │
│  │     │   ├─ On hit: onTvShowRecognized → saveMediaMetadata(+tvShow)│ │ │
│  │     │   │                                                            │ │ │
│  │     │   └─ Stage 2: recognizeTvShowEpisodes  [Match episodes]      │ │ │
│  │     │       └─ recognizeEpisodesAsync(mm) (Web Worker)            │ │ │
│  │     │          Patterns: SXXEYY / 第X季第Y集 / fuzzy match        │ │ │
│  │     │       └─ onEpisodeRecognized → saveMediaMetadata(+mediaFiles)│ │ │
│  │     ├─────────────────────────────────────────────────────────────┤ │ │
│  │     │ movie:                                                     │ │ │
│  │     │   ├─ recognizeMovie(mm)                                     │ │ │
│  │     │   │   Same pipeline as tvshow                               │ │ │
│  │     │   │   (movie.nfo / tmdbid in folder / tvdbid in folder /    │ │ │
│  │     │   │    search in TMDB/TVDB)                                 │ │ │
│  │     │   ├─ On hit: onMovieRecognized → saveMediaMetadata(+movie)  │ │ │
│  │     │   └─ recognizeMovieEpisode → Pick first video file in       │ │ │
│  │     │       mm.files                                              │ │ │
│  │     │       → onEpisodeRecognized → saveMediaMetadata(+mediaFiles)│ │ │
│  │     ├─────────────────────────────────────────────────────────────┤ │ │
│  │     │ music:                                                     │ │ │
│  │     │   └─ logger.info('skip initialization for music folder')   │ │ │
│  │     └─────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                     │                                    │
│                                     ▼                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Phase 3: try / catch / finally (always runs)                        │ │
│  │                                                                     │ │
│  │  try {                                                              │ │
│  │    doInitialization()                                               │ │
│  │    onSucceeded(folder) → updateJob(jobId, 'succeeded')              │ │
│  │  }                                                                  │ │
│  │                                                                     │ │
│  │  catch (error) {                                                    │ │
│  │    onError(folder, error):                                          │ │
│  │      ├─ if TimeoutError: toast.error('初始化目录超时')              │ │
│  │      │                       updateJob('aborted')                  │ │
│  │      └─ else:         toast.error(unknown reason)                 │ │
│  │                       updateJob('failed')                          │ │
│  │  }                                                                  │ │
│  │                                                                     │ │
│  │  finally {                                                          │ │
│  │    onFinish(folder):                                                │ │
│  │      └─ upsertFolder({ path, status: 'ok' })  ← UI status reset    │ │
│  │    data.onCompleted?.()  ← Notify caller (e.g. Library batch)      │ │
│  │    mutex.release()                                                  │ │
│  │  }                                                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Key Module Index

| File | Role |
|------|------|
| `apps/ui/src/main.tsx:153` | Registers `MediaFolderImportedEventHandler` |
| `apps/ui/src/components/eventlisteners/MediaFolderImportedEventHandler.tsx` | Event listener + mutex |
| `apps/ui/src/hooks/initialization/useInitializeImportedMediaFolder.ts` | **Core**: 3-phase pipeline |
| `apps/ui/src/lib/mediaFolderRecognitionPipeline.ts` | `runRecognitionSteps` short-circuit logic |
| `apps/ui/src/hooks/initialization/useRecognize*.ts` | 12 recognition strategy hooks (nfo / idInName / search) |
| `apps/ui/src/hooks/mediaMetadata/useInitializeMediaMetadataMutation.ts` | listFiles → build MediaMetadata |
| `apps/ui/src/hooks/mediaMetadata/useUpdateMediaMetadataMutation.ts` | Write to mediaMetadataRepository |
| `apps/ui/src/hooks/userConfig/useAddMediaFolderMutation.ts` | Write smm.json (user config) |
| `apps/ui/src/lib/recognizeEpisodes.ts` | Web Worker, episode file matching (SXXEYY etc.) |
| `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.tsx` | Bootstrap: sync userConfig → Zustand on startup |

## 4. Key Design Points

1. **Optimistic update + error rollback**: `onStart` immediately sets folder status to `initializing`; on failure, `onError`/`onFinish` reset to `ok`.
2. **Mutex serialization**: Global single `Mutex` prevents concurrent imports of the same folder from racing on metadata.
3. **60-second hard timeout**: `withTimeout(..., 60_000)`; timeout is marked as `aborted` separately.
4. **Three-stage persistence**: userConfig (`smm.json`) → initial empty metadata → incremental metadata after recognition (`onTvShowRecognized` / `onEpisodeRecognized`).
5. **Recognition strategy short-circuit**: `runRecognitionSteps` executes 4 categories of strategies in order; the first to return non-`undefined` terminates the pipeline. Logs use the format `[traceId] HIT/MISS: <logLabel>`.
6. **Observability**: Every phase emits `logger.info({ traceId, folder, ... }, ...)`; each initialization is also attached to the Job Manager and shown in the StatusBar.
7. **Skip optimistic UI**: The Library import path sets `skipOptimisticUpdate=true`, because `MediaLibraryImportedEventHandler` already performs batched UI updates.

## 5. Related Bootstrap Flow

```
On app startup (main.tsx)
  └─> UIMediaFolderStoreInitializer
        ├─ useRecheckSelectedFolderAvailability (watches selectedFolder)
        ├─ Wait for userConfig to load
        ├─ reactivateHarmonyOSFileAccess(userConfig.folders)
        ├─ setFolders(folders) with status='ok'
        ├─ Restore selectedFolder from localStorage
        └─ For each folder: isFolderAvailable() → updateFolderStatus('folder_not_found' if missing)
```
