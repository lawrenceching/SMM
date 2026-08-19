# Core.scrapeFolder (TV / TMDB scrape)

This design document describes migrating the ScrapeDialog batch scrape workflow into Layer 2 `apps/core`, exposing a direct CLI command. UI and existing HTTP routes stay unchanged in this milestone.

## 1. Background

ScrapeDialog (`useScrapeDialog`) runs four tasks for a **recognized** media folder:

| Task ID | Output |
|---------|--------|
| `poster` | `poster.{ext}` in media folder root |
| `fanart` | `fanart.{ext}` in media folder root |
| `thumbnails` | per-episode still image beside each video (same stem, image ext) |
| `nfo` | `tvshow.nfo` + one `{videoStem}.nfo` per linked episode |

Today the UI invokes TanStack Query mutations (`useScrapePosterMutation`, etc.) that call TMDB/TVDB APIs, download images via HTTP proxy failover, and write NFO XML via helpers in `apps/ui/src/lib/nfo` and `useHandleScrapeStart`.

Recognize/rename were migrated as **Core + CLI** pipelines without UI changes. Scrape follows the same pattern but uses **direct execution** (no plan review step).

**Constraints (product decision):**

- Scope: **Core + CLI only**; do not modify `apps/ui/**` or `packages/core-routes/**`.
- **TV show + TMDB only** this milestone (no TVDB, no movie).
- All **four tasks** run by default; **skip** when target files already exist (same as UI).
- Per-task failure does **not** abort remaining tasks (same as ScrapeDialog loop).
- Prerequisite: folder is managed, metadata exists, `tvShow.database === "TMDB"`, episodes linked in `mediaFiles` (for thumbnails / episode NFO).
- Language defaults to `userConfig.preferMediaLanguage`.

## 2. Architecture

### 2.1 Project Level Architecture

```
apps/ui ScrapeDialog ──unchanged──► UI mutations + HTTP APIs
packages/core-routes ──unchanged──► downloadImage, writeFile, etc.
apps/cli  smm scrape <folder> ──new──► Core.scrapeFolder
apps/core Core.scrapeFolder ──new──► scrape pipeline (TMDB + FsPort + NetworkPort)
```

### 2.2 App Level Architecture

| Piece | Role |
|-------|------|
| `Core.scrapeFolder(path, opts?)` | Managed check → metadata → run 4 tasks → return per-task results |
| `pipeline/scrape/scrapeFolder.ts` | Orchestrator: completion check, sequential tasks, aggregate results |
| `pipeline/scrape/checkScrapeCompletion.ts` | Port UI `checkTaskCompletion` using `FsPort.listFiles` |
| `pipeline/scrape/tmdbImageUrl.ts` | Port `getTMDBImageUrl` |
| `pipeline/scrape/downloadScrapeImage.ts` | Fetch image URL via `NetworkPort`, write via `FsPort.writeBinaryFile` |
| `pipeline/scrape/buildTvShowNfoTmdb.ts` | Port TMDB NFO builders from `useHandleScrapeStart` |
| `pipeline/scrape/nfoXml.ts` | Port `convertTvShowNfoToXml` / `convertTvShowEpisodeNfoToXml` (TV TMDB subset) |
| `pipeline/scrape/scrapePosterTmdb.ts` | Poster task |
| `pipeline/scrape/scrapeFanartTmdb.ts` | Fanart task |
| `pipeline/scrape/scrapeThumbnailsTmdb.ts` | Thumbnails task |
| `pipeline/scrape/scrapeNfoTmdb.ts` | NFO task |
| `FsPort.writeBinaryFile` | New port method for image bytes |
| `clients/TmdbClient` | Already has `getTvShowById`, `getTvSeasonById` |

### 2.3 Key Design

#### Core signatures

```ts
export type ScrapeTaskId = "poster" | "fanart" | "thumbnails" | "nfo"

export type ScrapeTaskStatus = "skipped" | "completed" | "failed"

export interface ScrapeTaskResult {
  status: ScrapeTaskStatus
  error?: string
}

export interface ScrapeFolderResult {
  mediaFolderPath: string
  tasks: Record<ScrapeTaskId, ScrapeTaskResult>
}

export interface ScrapeFolderOptions {
  /** Defaults to userConfig.preferMediaLanguage */
  language?: string
}

Core.scrapeFolder(path: string, options?: ScrapeFolderOptions): Promise<ScrapeFolderResult>
```

#### `scrapeFolder` step order

1. Normalize path; assert managed (`{path} is not managed by SMM`).
2. Load metadata; throw if missing (`Media metadata not found: {path}`).
3. Require `type === "tvshow-folder"` with `tvShow.database === "TMDB"`; else throw.
4. Resolve language from options or user config.
5. Build `TmdbClient` from user config + discover (same as import pipeline).
6. `completion = checkScrapeCompletion(metadata, fs)`.
7. For each task in order `[poster, fanart, thumbnails, nfo]`:
   - If `completion[task]` → record `skipped`.
   - Else try task runner; on success `completed`, on error `failed` + message (continue).
8. Return aggregated result (no metadata refresh in Core — CLI may optionally re-fetch later; UI refreshes separately).

#### Skip semantics (match UI)

- **poster / fanart:** skip if `poster.{imageExt}` / `fanart.{imageExt}` already exists under folder (recursive list).
- **nfo:** skip if `tvshow.nfo` exists and every linked episode has matching `{videoStem}.nfo`.
- **thumbnails:** skip if every linked episode has a same-stem image file in the video directory.

#### Image download

- Resolve TMDB image URL (`https://image.tmdb.org/t/p/original{path}`).
- Download via `NetworkPort.fetch` with browser-like headers.
- Write bytes with `FsPort.writeBinaryFile` (create parent dirs if needed via `mkdir`).
- Do **not** depend on `packages/core-routes` from `apps/core` (layering).

#### HTTP proxy

- Reuse `resolveScrapeHttpProxy` logic ported to core (from UI `mediaDatabaseAccess`) for TMDB image fetches when custom host + proxy configured.

## 3. User Stories

### 3.1 CLI operator scrapes a recognized TV folder

* **Given** a managed TV folder with TMDB metadata and `mediaFiles` linking S01E01..03
* **When** the operator runs `smm scrape <folder>`
* **Then** poster, fanart, episode thumbnails, and NFO files are created on disk
* **And** stdout reports each task as `completed`, `skipped`, or `failed`

### 3.2 Skip existing artifacts

* **Given** `poster.jpg` already exists
* **When** `smm scrape` runs
* **Then** the poster task is `skipped` and other tasks still run

### 3.3 Error isolation

* **Given** TMDB returns no backdrop (fanart fails)
* **When** `smm scrape` runs
* **Then** fanart is `failed`, poster/thumbnails/nfo still attempt

## 4. Out of scope

- UI wiring / ScrapeDialog migration to Core
- TVDB database support
- Movie folders
- `--force` overwrite flag
- Plan-based scrape (`try-to-scrape` / `apply`)
- Refreshing metadata after scrape (UI concern; optional CLI follow-up)

## 5. Testing strategy

- Unit tests for `checkScrapeCompletion`, `tmdbImageUrl`, NFO XML round-trip
- `Core.test.ts` integration with in-memory FsPort + mock NetworkPort
- `apps/cli/test/scrape-e2e.test.ts`: import → recognize → apply → scrape → assert files on disk
