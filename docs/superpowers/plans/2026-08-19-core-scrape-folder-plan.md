# Core.scrapeFolder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Core.scrapeFolder(path, opts?)` for TV/TMDB scrape (poster, fanart, thumbnails, nfo) plus CLI `smm scrape`, without changing UI or core-routes.

**Architecture:** Port scrape helpers into `apps/core/src/pipeline/scrape/`. Extend `FsPort` with binary write. Orchestrate four task runners sequentially with skip-on-existing semantics. Return per-task results (no plan file).

**Tech Stack:** TypeScript, Vitest, `TmdbClient`, `FsPort`, `NetworkPort`, Commander CLI.

**Spec:** `docs/superpowers/specs/2026-08-19-core-scrape-folder-design.md`

## Global Constraints

- Do **not** modify `apps/ui/**` or `packages/core-routes/**` source.
- Scope is **Core + CLI only**.
- **TV show + TMDB only**; skip TVDB and movie.
- Default: run all 4 tasks; **skip** when artifacts already exist.
- Per-task errors → `failed` status; continue remaining tasks.
- Register `scrape` in `apps/cli/index.ts` `cliCommands`.
- Managed / metadata validation throws `Error` (CLI exit 1).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/ports/FsPort.ts` | Add `writeBinaryFile` |
| `apps/core/src/adapters/node/NodejsFsAdapter.ts` | Implement binary write |
| `apps/core/src/adapters/network/NetworkFsAdapter.ts` | Stub or HTTP binary write |
| `apps/core/src/pipeline/scrape/types.ts` | ScrapeTaskId, results |
| `apps/core/src/pipeline/scrape/tmdbImageUrl.ts` | TMDB image URL builder |
| `apps/core/src/pipeline/scrape/checkScrapeCompletion.ts` | Skip detection |
| `apps/core/src/pipeline/scrape/downloadScrapeImage.ts` | Network fetch + fs write |
| `apps/core/src/pipeline/scrape/buildTvShowNfoTmdb.ts` | NFO object builders |
| `apps/core/src/pipeline/scrape/nfoXml.ts` | NFO → XML (TV subset) |
| `apps/core/src/pipeline/scrape/scrapePosterTmdb.ts` | Poster task |
| `apps/core/src/pipeline/scrape/scrapeFanartTmdb.ts` | Fanart task |
| `apps/core/src/pipeline/scrape/scrapeThumbnailsTmdb.ts` | Thumbnails task |
| `apps/core/src/pipeline/scrape/scrapeNfoTmdb.ts` | NFO task |
| `apps/core/src/pipeline/scrape/scrapeFolder.ts` | Orchestrator |
| `apps/core/src/Core.ts` | `scrapeFolder` wrapper |
| `apps/core/src/Core.test.ts` | Integration tests |
| `apps/cli/src/cli/runCli.ts` | `scrape` command |
| `apps/cli/index.ts` | Register `scrape` |
| `apps/cli/test/scrape-e2e.test.ts` | CLI e2e |
| `docs/api/index.md` | CLI note |

---

### Task 1: FsPort.writeBinaryFile + tmdbImageUrl

**Files:**
- Modify: `FsPort.ts`, `NodejsFsAdapter.ts`, `NetworkFsAdapter.ts`, test fakes
- Create: `pipeline/scrape/tmdbImageUrl.ts`, `tmdbImageUrl.test.ts`

**Interfaces:**
- `FsPort.writeBinaryFile(path: string, data: Uint8Array): Promise<void>`
- `getTmdbImageUrl(path: string | null | undefined, size: "original" | "w500"): string | null`

Port URL builder from `apps/ui/src/api/tmdb.ts` `getTMDBImageUrl`.

- [ ] TDD adapter test: write binary, read back
- [ ] TDD tmdbImageUrl tests
- [ ] Commit: `feat(core): add FsPort.writeBinaryFile and tmdbImageUrl`

---

### Task 2: checkScrapeCompletion

**Files:**
- Create: `pipeline/scrape/types.ts`
- Create: `pipeline/scrape/checkScrapeCompletion.ts`, `.test.ts`

Port logic from `apps/ui/src/lib/scrapeDialog/checkTaskCompletion.ts` using `FsPort.listFiles`, `basename`/`dirname`/`extname` from `pipeline/paths`.

- [ ] TDD: poster/fanart/nfo/thumbnails completion cases
- [ ] Commit: `feat(core): add checkScrapeCompletion for scrape skip`

---

### Task 3: downloadScrapeImage

**Files:**
- Create: `pipeline/scrape/downloadScrapeImage.ts`, `.test.ts`
- Create: `pipeline/scrape/resolveScrapeHttpProxy.ts` (port from UI `mediaDatabaseAccess`)

Fetch image with NetworkPort; write with writeBinaryFile; mkdir parent dir.

- [ ] TDD with mock network + in-memory fs
- [ ] Commit: `feat(core): add downloadScrapeImage for scrape pipeline`

---

### Task 4: NFO build + XML (TMDB TV)

**Files:**
- Create: `pipeline/scrape/buildTvShowNfoTmdb.ts`, `.test.ts`
- Create: `pipeline/scrape/nfoXml.ts`, `.test.ts`

Port `buildTvShowNfo`, `buildTvShowEpisodeNfo` from `apps/ui/src/hooks/useHandleScrapeStart.ts` and XML converters from `apps/ui/src/lib/nfo/tvshowNfo.ts` + episode converter (minimal fields used by scrape).

- [ ] TDD: builder output shape + XML contains title/tmdbid
- [ ] Commit: `feat(core): add TMDB TV NFO build and XML for scrape`

---

### Task 5: Scrape task runners (poster, fanart, thumbnails, nfo)

**Files:**
- Create: `scrapePosterTmdb.ts`, `scrapeFanartTmdb.ts`, `scrapeThumbnailsTmdb.ts`, `scrapeNfoTmdb.ts`
- Create: unit tests with mocked TmdbClient + fs

Each runner: resolve URL or NFO content → skip if file exists → download/write.

- [ ] TDD each task (at least poster + nfo; fanart/thumbnails smoke)
- [ ] Commit: `feat(core): add TMDB TV scrape task runners`

---

### Task 6: scrapeFolder orchestrator + Core.scrapeFolder

**Files:**
- Create: `pipeline/scrape/scrapeFolder.ts`
- Modify: `Core.ts`, `Core.test.ts`, `index.ts`

Wire managed check, metadata, TmdbClient, sequential tasks, result aggregation.

- [ ] Core.test.ts: happy path creates poster; skip when exists; unmanaged throws
- [ ] Commit: `feat(core): add Core.scrapeFolder`

---

### Task 7: CLI smm scrape + e2e

**Files:**
- Modify: `runCli.ts`, `index.ts`
- Create: `apps/cli/test/scrape-e2e.test.ts`
- Modify: `docs/api/index.md`

Flow: recognize → apply → scrape → assert poster/fanart/thumbnail/nfo on disk.

- [ ] E2E RED → GREEN
- [ ] Commit: `feat(cli): add smm scrape for TV folders`

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Core.scrapeFolder direct API | 6 |
| 4 tasks, skip existing | 2, 5, 6 |
| TV + TMDB only | 5, 6 |
| Per-task error isolation | 6 |
| CLI smm scrape | 7 |
| No UI / core-routes | Global |
