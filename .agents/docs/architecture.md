# Architecture

## Project Level Architecture

This section describe the software architecture among `apps/*` apps.

 ```
   ┌──────────────────────────────────────────────────────────┐
   │                    apps/electron                          │
   │                                                          │
   │  ┌────────── BrowserWindow ──────────────────────────┐   │
   │  │                                                    │   │
   │  │  Loads http://localhost:{cliPort}                  │   │
   │  │                                                    │   │
   │  │  ┌──────────────────────────────────────────────┐ │   │
   │  │  │       apps/ui (static files from dist/)       │ │   │
   │  │  │  ┌──────────┐  ┌────────────────┐            │ │   │
   │  │  │  │ HTTP API │  │ Socket.IO      │            │ │   │
   │  │  │  └────┬─────┘  └───────┬────────┘            │ │   │
   │  │  └───────┼────────────────┼──────────────────────┘ │   │
   │  └──────────┼────────────────┼────────────────────────┘   │
   │             │                │                             │
   │  ┌──────────┼────────────────┼────────────────────────┐   │
   │  │          ▼                ▼                        │   │
   │  │     apps/cli (child process)                       │   │
   │  │     Bun + Hono + Socket.IO                         │   │
   │  │     Serves: /api/*, /socket.io, static files        │   │
   │  └────────────────────────────────────────────────────┘   │
   │                                                          │
   │  Main Process also provides IPC:                         │
   │  - dialog:showOpenDialog (native file picker)            │
   │  - ExecuteChannel (channel routing for OS operations)    │
   └──────────────────────────────────────────────────────────┘
 ```

## App Level Architecture

This section describe the architecture within specific app, including the dependency between one app and packages.

### apps/ui

The frontend application built with **React 19 + Vite 7 + Tailwind CSS 4 + Shadcn UI (Radix UI)**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         main.tsx (Bootstrap)                         │
│                                                                      │
│  i18nReady──┐                                                       │
│             ▼                                                        │
│  <QueryClientProvider>                                               │
│    <ThemeProvider>                                                   │
│      <JobOrchestratorProvider>                                       │
│        <DialogProvider>                                              │
│          <AppLanguageSync />                                         │
│          <UIMediaFolderStoreInitializer />                           │
│          <AppInitializer />                                          │
│          <AppSwitcher>                                               │
│            ├── Desktop ── <AppV2 />                                  │
│            └── Mobile  ── <AppNavigation />                          │
│            <WebSocketHandlers />                                     │
│            <EventListeners />                                        │
│          </AppSwitcher>                                              │
│        </DialogProvider>                                             │
│      </JobOrchestratorProvider>                                      │
│    </ThemeProvider>                                                  │
│  </QueryClientProvider>                                              │
└─────────────────────────────────────────────────────────────────────┘
```

#### Content Panel Architecture

Each content panel (TvShowPanel, MoviePanel, MusicPanel) is conditionally rendered by `AppV2Content` based on `selectedMediaMetadata.type`.

##### TvShowPanel

```
┌─────────────────────────────────────────────────────────────────┐
│                       TvShowPanel                                │
│                                                                  │
│  ┌─ TvShowPanelPrompts ──────────────────────────────────────┐  │
│  │  • UseNfoPrompt              • AiBasedRecognizePrompt      │  │
│  │  • UseTmdbidFromFolderNamePrompt                           │  │
│  │  • RuleBasedRecognizePrompt  • AiBasedRenameFilePrompt     │  │
│  │  • RuleBasedRenameFilePrompt                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ TvShowHeaderV2 ──────────────────────────────────────────┐  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │  MediaDatabaseSearchbox (TMDB/TVDB)                │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │                                                             │  │
│  │  ┌────── Action Bar ──────────────────────────────────┐    │  │
│  │  │  [Recognize ▼]  [Rename ▼]  [More ▼]              │    │  │
│  │  │   ┌──────────────┐   ┌──────────────────────┐     │    │  │
│  │  │   │ Rule-based   │   │ Scrape               │     │    │  │
│  │  │   │ AI-based     │   │ Transcribe           │     │    │  │
│  │  │   │              │   │ Translate            │     │    │  │
│  │  │   │              │   │ Synthesize           │     │    │  │
│  │  │   │              │   │ Process Pipeline     │     │    │  │
│  │  │   └──────────────┘   └──────────────────────┘     │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │                                                             │  │
│  │  ┌── Episode Table Layout Switcher ────────────────────┐    │  │
│  │  │  [Simple] [Detail] [Preview]                        │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ TvShowEpisodeTable ───────────────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Season X (divider row)                              │   │  │
│  │  ├──────────────────────────────────────────────────────┤   │  │
│  │  │  ☑ S01E01 │ Episode Title │ Video.mp4 │ Sub.srt     │   │  │
│  │  │  ☐ S01E02 │ Episode Title │ Video.mp4 │ Sub.srt     │   │  │
│  │  │  ☑ S01E03 │ Episode Title │ ── (unlinked) ──        │   │  │
│  │  │  ...                                                 │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │  Each row supports (via ContextMenu):                       │  │
│  │  • Select File  → FilePickerDialog / native dialog          │  │
│  │  • Unlink Episode → remove file association                 │  │
│  │  • Edit Tags → EditMediaFileDialog (FFmpeg metadata)        │  │
│  │  • Thumbnail preview via HoverCard                          │  │
│  │                                                             │  │
│  │  Preview Mode (when a plan is active):                      │  │
│  │  • Recognize preview: shows detected episodes with ✓/✗     │  │
│  │  • Rename preview: shows old → new file paths               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Floating Dialogs (opened via useDialogs):                       │
│  • TranscribeDialog   • SubtitleTranslationDialog                │
│  • SynthesizeSubtitleDialog  • ProcessPipelineDialog             │
└─────────────────────────────────────────────────────────────────┘
```

##### MoviePanel

```
┌─────────────────────────────────────────────────────────────────┐
│                       MoviePanel                                  │
│                                                                  │
│  ┌─ MovieHeaderV2 ───────────────────────────────────────────┐  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │  MediaDatabaseSearchbox (TMDB/TVDB)                │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │                                                             │  │
│  │  ┌────── Action Bar ──────────────────────────────────┐    │  │
│  │  │  [Rename ▼]    [More ▼]                           │    │  │
│  │  │                    ┌──────────────────────────┐    │    │  │
│  │  │                    │ Scrape                    │    │    │  │
│  │  │                    │ Transcribe                │    │    │  │
│  │  │                    │ Translate                 │    │    │  │
│  │  │                    │ Synthesize                │    │    │  │
│  │  │                    │ Process Pipeline          │    │    │  │
│  │  │                    └──────────────────────────┘    │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ MovieEpisodeTable ────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  ✓   video   │ Movie (2024).mp4                     │   │  │
│  │  │  ✓   subtitle │ Movie.cht.srt                        │   │  │
│  │  │  ✓   poster   │ poster.jpg                          │   │  │
│  │  │  ✓   nfo      │ movie.nfo                           │   │  │
│  │  │  ✓   audio    │ commentary.mp3                      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │  Preview Mode (when rename prompt is open):                  │  │
│  │  • Shows current path ~ strikethrough ~ → new path          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ RuleBasedRenameFilePrompt ───────────────────────────────┐  │
│  │  • Naming rule selector (Plex / Emby)                      │  │
│  │  • [Confirm] / [Cancel]                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Floating Dialogs (opened via useDialogs):                       │
│  • TranscribeDialog   • SubtitleTranslationDialog                │
│  • SynthesizeSubtitleDialog  • ProcessPipelineDialog             │
└─────────────────────────────────────────────────────────────────┘
```

##### MusicPanel

```
┌─────────────────────────────────────────────────────────────────┐
│                       MusicPanel                                  │
│                                                                  │
│  ┌─ MusicHeaderV2 ───────────────────────────────────────────┐  │
│  │  • Folder name + track count                               │  │
│  │                                                             │  │
│  │  ┌────── Action Bar ──────────────────────────────────┐    │  │
│  │  │  [Download]  [Multi-Select Toggle]  [More ▼]      │    │  │
│  │  │                                    ┌────────────┐  │    │  │
│  │  │                                    │ Transcribe │  │    │  │
│  │  │                                    │ Translate  │  │    │  │
│  │  │                                    │ Synthesize │  │    │  │
│  │  │                                    │ Process    │  │    │  │
│  │  │                                    └────────────┘  │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ MusicFileTable (with LocalFileSubtitleScope) ─────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  ♪ Track 1 │ Artist A │ 3:45 │ [progress bar]      │   │  │
│  │  │  ♪ Track 2 │ Artist B │ 4:20 │                      │   │  │
│  │  │  ⏳ Download Job │ URL │ pending │ [▐▐] [✕]       │   │  │
│  │  │  ♪ Track 3 │ Artist C │ 2:58 │ [✓ selected]         │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │  Row types:                                                 │  │
│  │  • LocalFileTableRow — existing music file with context menu│  │
│  │    (Open, Delete, Properties, Format Convert, Edit Tags)    │  │
│  │  • JobTableRow — active download job (pending/running)      │  │
│  │    with start/stop/remove controls                          │  │
│  │                                                             │  │
│  │  Selection & Multi-Select Mode:                             │  │
│  │  • Single click → play track                                │  │
│  │  • Multi-select → bulk subtitle pipeline operations         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ MediaPlayer (embedded) ───────────────────────────────────┐  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  MediaPlayerToolbar (sort, filter)                    │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  MediaPlayerTrackList (track listing with thumbnails) │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  MediaPlayerControlBar                                │   │  │
│  │  │  [⏮] [▶/⏸] [⏭] [🔀] [🔁] [🔊────] [──⊡──]       │   │  │
│  │  │  Play/Pause │ Skip │ Shuffle │ Repeat │ Volume │ Seek │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Floating Dialogs (opened via useDialogs):                       │
│  • TranscribeDialog   • SubtitleTranslationDialog                │
│  • SynthesizeSubtitleDialog  • ProcessPipelineDialog             │
│  • DeleteTrackDialog  • FilePropertyDialog                       │
│  • FormatConverterDialog  • EditMediaFileDialog                  │
│  • DownloadVideoDialog                                           │
└─────────────────────────────────────────────────────────────────┘
```

#### App Layout (Desktop — AppV2)

The desktop view uses a 5-region CSS Grid layout:

```
┌─────────────────────────────────────────┐
│           AppWarningBanner               │
├─────────────────────────────────────────┤
│              Toolbar                     │
├──────────────┬──────────────────────────┤
│              │                          │
│   Sidebar    │    Content Panel          │
│              │                          │
│  (resizable) │  ┌──────────────────┐   │
│              │  │ TvShowPanel       │   │
│              │  │ MoviePanel        │   │
│              │  │ MusicPanel        │   │
│              │  │ LocalFilePanel    │   │
│              │  │ Welcome           │   │
│              │  └──────────────────┘   │
├──────────────┴──────────────────────────┤
│               StatusBar                  │
└─────────────────────────────────────────┘

   <Assistant /> (AI chat overlay, always mounted)
   <Toaster /> (toast notifications)
```

- **Toolbar**: Open folder/library buttons, view mode switcher (metadata/files)
- **Sidebar**: Media folder list with selection (v2), multi-select, delete
- **Content Panel**: Selected by `selectedMediaMetadata.type` — renders the matching panel (tvshow-folder, movie-folder, music-folder) or a LocalFilePanel for unrecognized folders
- **StatusBar**: Connection status, folder status, background job count
- **Assistant**: Floating AI chat overlay (mounted globally)

#### State Management Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       State Management                              │
│                                                                      │
│  ┌────────────────────┐      ┌──────────────────────────────────┐  │
│  │   Zustand Stores    │      │      TanStack Query (Server)     │  │
│  │                      │      │                                  │  │
│  │ • uiMediaFolderStore │──────│→ useUserConfigQuery              │  │
│  │   (folders,selection)│      │→ useConfig (read+write)          │  │
│  │ • backgroundJobsStore│      │→ useMediaMetadataQuery           │  │
│  │ • plansStore         │      │→ useFetchMediaMetadataMutation   │  │
│  │ • sidebarStore       │      │→ useInitializeMediaMetadataMut.  │  │
│  │ • statusbarStore     │      │→ useUpdateMediaMetadataMut.      │  │
│  │ • tvShowPromptsStore │      │→ useTmdbQueries                  │  │
│  │                      │      │→ useTvdbQueries                  │  │
│  │  Local UI state      │      │→ useGetTmdbTvShowMutation        │  │
│  │  (viewMode,          │      │→ useGetTmdbMovieMutation         │  │
│  │   sidebarWidth, ...) │      │→ useDownloadThumbnailFromTMDB    │  │
│  └──────────────────────┘      │→ useDownloadThumbnailFromTVDB    │  │
│                                 └──────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │               Global Contexts (React Context)                │    │
│  │  • DialogProvider (all dialogs)                              │    │
│  │  • GlobalStatesProvider (pending plans)                      │    │
│  │  • JobOrchestratorProvider (background jobs)                 │    │
│  │  • ThemeProvider (light/dark/system)                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Key architectural points:**
- Zustand stores hold **local UI state** (folder list, selection, sidebar, background jobs, prompts)
- TanStack Query manages **server state** (user config, media metadata, TMDB/TVDB data) with caching, optimistic updates, and background refetching
- All state mutations follow the **Optimistic Update Strategy**: update UI first, then call the backend API, rollback on failure

#### API Layer (`src/api/`)

Each `api/*.ts` file wraps a CLI HTTP endpoint (e.g. `/api/listFiles`, `/api/readFile`). Most calls are consumed via TanStack Query hooks in `src/hooks/`. The flow:

```
React Component
      │
      ▼
TanStack Query Hook (e.g. useMediaMetadataQuery)
      │
      ▼
API function (e.g. mediaMetadataRepository.read())
      │
      ▼
fetch() → http://localhost:<port>/api/...
      │
      ▼
apps/cli (Hono route handler)
```

#### Real-Time Communication

- WebSocket connection established in `<AppSwitcher>` (persists across view switches)
- Socket.IO event → `<WebSocketHandlers>` dispatches custom DOM events (e.g. `socket.io_mediaMetadataUpdated`)
- `<EventListeners>` components react to these DOM events (e.g. `MediaMetadataUpdatedEventListener` invalidates queries)

```
apps/cli (Socket.IO server)
      │
      ▼
useWebSocket() hook (socket.io-client)
      │
      │  onAny((event, data) => dispatch CustomEvent)
      ▼
Custom DOM event: 'socket.io_' + eventName
      │
      ▼
EventListener components (e.g. MediaMetadataUpdatedEventListener)
      │
      ▼
TanStack Query invalidation / Zustand store update
```

#### AI Integration

The `<Assistant />` component uses `@assistant-ui/react` with `@ai-sdk/react` to provide an AI chat overlay:

```
┌──────────────────────────────────────────────────┐
│                  Assistant                         │
│  ┌─────────────────────────────────────────────┐  │
│  │  Thread (chat messages)                      │  │
│  │  • User messages                             │  │
│  │  • AI assistant messages (markdown)          │  │
│  │  • Tool calls (executed by AI SDK)           │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │  AI Tools (src/ai/tools/)                    │  │
│  │  • GetMediaFolders  — list all media folders │  │
│  │  • GetMediaMetadata — get folder metadata    │  │
│  │  • ListFilesInMediaFolder — list folder files│  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  Communication:                                   │
│  Assistant → chat API (Socket.IO) → apps/cli      │
│              → AI provider (OpenAI-compatible)     │
└──────────────────────────────────────────────────┘
```

The assistant can also interact with the **MCP (Model Context Protocol) server** running on the CLI side.

#### Dialogs System

All dialogs are managed via `DialogProvider` (React Context) and opened imperatively:

| Dialog | Purpose |
|--------|---------|
| OpenFolderDialog | Select folder type when importing |
| FilePickerDialog | Browser-based file/folder picker |
| MediaSearchDialog | Search TMDB/TVDB for media identification |
| RenameFileDialog | Preview and confirm file renames |
| RenameFolderDialog | Preview and confirm folder renames |
| ScrapeDialog / ScrapeDialogV2 | Scrape metadata from TMDB/TVDB |
| DownloadVideoDialog | yt-dlp video download UI |
| FormatConverterDialog | FFmpeg conversion UI |
| ExecuteCmdDialog | Execute whitelisted system commands |
| ConfigDialog | Application settings panel |
| ConfirmationDialog | Generic Yes/No confirmation |
| TextDialog | Multi-line text input |
| FilePropertyDialog | Edit file properties |
| LogDialog | View application logs |

#### Background Jobs System

```
┌─────────────────────────────────────────────┐
│         Background Jobs Architecture          │
│                                               │
│  JobOrchestratorProvider (global context)     │
│       │                                       │
│       ├── JobOrchestrator (process queue)     │
│       │   ├── FFmpeg jobs (convert, snapshot) │
│       │   ├── yt-dlp jobs (download)          │
│       │   ├── Transcribe jobs (ASR)           │
│       │   ├── Translate jobs                  │
│       │   └── Synthesize jobs (TTS)           │
│       │                                       │
│       └── backgroundJobsStore (Zustand)       │
│           └── UI: BackgroundJobsPopover       │
└─────────────────────────────────────────────┘
```

Jobs are long-running operations (FFmpeg conversion, yt-dlp download, speech transcription) that run in the CLI backend and report progress via Socket.IO.

#### Mobile Layout (`AppNavigation`)

A separate mobile-optimized view with slide-page navigation (list → detail), detected by screen width < 768px. Components live in `src/components/mobile/` (NavBar, Toolbox).

#### Key Technologies Used

| Technology | Purpose |
|-----------|---------|
| React 19 | UI framework |
| Vite 7 | Build tool & dev server |
| Tailwind CSS 4 + Shadcn UI | Styling & component library |
| Zustand 5 | Local state management |
| TanStack Query 5 | Server state caching & sync |
| @assistant-ui/react | AI chat UI |
| @ai-sdk/react | AI SDK integration |
| Socket.IO Client | Real-time communication |
| i18next + react-i18next | Internationalization (4 languages) |
| react-resizable-panels | Resizable sidebar |
| sonner | Toast notifications |
| Storybook | Component development & documentation |
| Vitest | Unit testing |
| React Compiler (Babel) | Automatic memoization optimization |

#### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/api/` | HTTP API client wrappers |
| `src/hooks/` | Custom React hooks (TanStack Query + business logic) |
| `src/stores/` | Zustand state stores |
| `src/providers/` | React Context providers |
| `src/components/` | UI components |
| `src/components/ui/` | Shadcn UI primitives (hand-installed) |
| `src/components/dialogs/` | Dialog components |
| `src/components/sidebar/` | Sidebar components |
| `src/components/v2/` | Desktop layout (Sidebar, Toolbar, ViewSwitcher) |
| `src/components/mobile/` | Mobile layout components |
| `src/components/eventlisteners/` | Socket.IO event → DOM event bridge |
| `src/components/background-jobs/` | Background job UI |
| `src/components/mcp/` | MCP-related UI |
| `src/components/initialization/` | Startup initialization logic |
| `src/ai/` | AI assistant, tools, prompts |
| `src/actions/` | Business logic actions (rename, recognize) |
| `src/lib/` | Utilities, mappers, validators |
| `src/types/` | UI-specific type definitions |
| `public/locales/` | i18n translation files (en, zh-CN, zh-HK, zh-TW) |

