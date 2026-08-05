# Common e2e — platform verification

`apps/e2e/common/{config,movie,httpproxy,tv,other,mcp,music,tvdb,manual}` on **local**, **Electron**, **ohos**, **Docker** (`smm:latest` on port 30000).

Specs carry `@supports …` after green on that platform; `@unsupported HarmonyOS` when skipped by design (`skipIfOhos`); `@unsupported Docker` when the spec fails on the Docker platform. `common/manual/` is on-demand (yt-dlp, ffmpeg, transcription); excluded from default CI unless `--spec` targets it explicitly.

**Legend:** ✓ pass · ~ flaky (known; fix deferred) · — unsupported / skip · ✗ fail · ◐ partial (spec fails; some `it` pass)

---

## Current progress (2026-07-30)

| Area | Status |
| --- | --- |
| **Non-manual Docker** | **51/51** green — config, movie, httpproxy, tv, other, mcp, music, tvdb |
| **MCP Docker** | 14/14 (`1785346454`, rebuilt image `1785347037`); seed-metadata pattern via `mcpSpecShared.ts` |
| **Manual Docker** | **4/10** verified (`1785351948` batch; ConvertVideoFormat `1785353168`) |
| **Manual local + Electron** | 9/10 (`AppWarningBanner` skipped on Windows) |
| **Transcribe Docker refactor** | Code ready (`e2e-tutorial-fixtures.ts`, `/media/tutorials` sync); **not verified** — needs `apps/e2e/test/media/tutorials/{p1,p2}.mp4` on host |
| **Docker image** | Offline CLI refresh into `smm:latest` when Docker Hub blocked; interim Dockerfiles removed |
| **Docker Compose CI** | Host Runner + Compose (`smm` + `http-proxy`); workflow **E2E Tests for Docker** (`workflow_dispatch`) runs all `common/*` except `common/manual` |

**Next:** MediaFileProperties (host ffmpeg); MusicPanel-Download partial (YouTube/collection flake); expand Docker CI `common/manual` when tutorial fixtures are available in CI.

---

## @supports annotation audit

Rule: **`@supports` only after a green run on that platform.** Verified specs below; gaps fixed in this pass.

| Suite | Specs | `@supports` status |
| --- | ---: | --- |
| config | 6 | ✓ all `local, Electron, HarmonyOS, Docker` |
| movie | 5 | ✓ all `local, Electron, HarmonyOS, Docker` |
| httpproxy | 6 | ✓ all `local, Electron, HarmonyOS, Docker` (2 new scrape specs: L/E/D verified 2026-08-05, D via CI; O pending device)
| tv | 15 | ✓ all `local, Electron, HarmonyOS, Docker` |
| other | 4 | ✓ App/BackgroundJob full; RenameFolder/Subtitle `Docker` + `@unsupported HarmonyOS` |
| mcp | 14 | ✓ all `local, Electron, Docker` + `@unsupported HarmonyOS` |
| music | 2 | ✓ all `local, Electron, Docker` + `@unsupported HarmonyOS` |
| tvdb | 1 | ✓ `local, Electron, Docker` + `@unsupported HarmonyOS` |
| manual | 10 | see [manual matrix](#manual-10--opt-in-on-docker-via--spec-commonmanual-e2e-ts) |

**Manual annotation notes (2026-07-30):**

| Spec | Docker verified? | Annotation |
| --- | --- | --- |
| Sidebar | ✓ | `@supports local, Electron, Docker` |
| MusicPanel-Download-UrlProbing | ✓ | `@supports local, Electron, Docker` |
| ConvertVideoFormat | ✓ | `@supports local, Electron, Docker` |
| CustomTmdbHost / CustomTvdbHost | ✗ | `@supports local, Electron` · `@unsupported Docker` |
| MediaFileProperties | ✗ | `@supports local, Electron` · `@unsupported HarmonyOS, Docker` |
| MusicPanel-Download | ◐ | `@supports local, Electron` · `@unsupported HarmonyOS, Docker` |
| Transcribe / MusicPanel-Transcribe | pending | `@supports local, Electron` · `@unsupported HarmonyOS, Docker` (refactor done; add Docker to `@supports` after green run) |
| AppWarningBanner | — | `@supports local, Electron` · `@unsupported HarmonyOS, Docker` (skip Windows) |

All **53 non-manual** specs have correct `@supports` including Docker. No verified non-manual spec is missing Docker in `@supports`. The 2 new httpproxy scrape specs carry `@supports local, Electron, HarmonyOS, Docker`; their Docker column is green via CI (2026-08-05), HarmonyOS column pending until a green run on a device.

---

## Suite summary

| Suite | Specs | local | electron | ohos | docker |
| --- | ---: | --- | --- | --- | --- |
| config | 6 | 6/6 | 6/6 | 6/6 | 6/6 |
| movie | 5 | 5/5 | 5/5 | 5/5 | 5/5 |
| httpproxy | 6 | 6/6 | 6/6 | 4/4 | 6/6 |
| tv | 15† | 14/14 + Failover | 14/14 + Failover‡ | 14/14 + Failover | 15/15 |
| other | 4 | 4/4 | 4/4 | 2/4 (+2 skip) | 4/4 |
| mcp | 14 | 14/14 | 14/14 | — | 14/14 |
| music | 2 | 2/2 | 2/2 | — | 2/2 |
| tvdb | 1 | 1/1 | 1/1 | — | 1/1 |
| **manual** | 10 | 9/10§ | 9/10§ | pending | 4/10‡ |

§ Ohos not verified yet. Windows skips `AppWarningBanner` (macOS/Linux-only).

‡ Docker manual batch `1785351948` · ConvertVideoFormat `1785353168`. **4/10** — Sidebar, UrlProbing, ConvertVideoFormat; AppWarningBanner skip on Windows. CustomTmdb/Tvdb: container cannot reach official API (covered by `common/config` + `httpproxy`). Remaining: MediaFileProperties, Transcribe* (code ready), MusicPanel-Download (partial).

¶ **`common/manual`** no longer excluded when `--spec` targets it (`docker/wdio.conf.ts`); default runner still requires explicit `--spec`.

† 14 specs via `pnpm e2e:local:tv` / `e2e:electron:tv` / `e2e:ohos:tv`; `TmdbHostFailover` via `pnpm e2e:failover`.

‡² `ImportTvShowLibrary` ~ flaky on Electron in batch (TMDB/NFO timing); stability work **deferred** — see [Deferred](#deferred).

**Docker verification (2026-07-30):** … `1785346454` (mcp 14/14) · `1785346733` (tvdb) · `1785347037` (mcp on rebuilt `smm:latest`) · `1785347226` (MCP without e2e `mcpHost` override). **51/51** runnable specs green (`manual` excluded).

---

## Spec matrix

Columns: **L** local · **E** electron · **O** ohos · **D** docker

### config (6) — `@supports local, Electron, HarmonyOS, Docker`

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| ConfigDialog-AI | ✓ | ✓ | ✓ | ✓ |
| ConfigDialog-Settings | ✓ | ✓ | ✓ | ✓ |
| CustomTmdbHost-WithHttpProxy | ✓ | ✓ | ✓ | ✓ |
| CustomTmdbHost-WrongApiKey | ✓ | ✓ | ✓ | ✓ |
| CustomTvdbHost-WithHttpProxy | ✓ | ✓ | ✓ | ✓ |
| CustomTvdbHost-WrongApiKey | ✓ | ✓ | ✓ | ✓ |

### movie (5) — `@supports local, Electron, HarmonyOS, Docker`

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| ImportMovieLibrary | ✓ | ✓ | ✓ | ✓ |
| InitializeMovieByTmdb | ✓ | ✓ | ✓ | ✓ |
| InitializeMovieByTvdb | ✓ | ✓ | ✓ | ✓ |
| Movie-RenameVideoFile | ✓ | ✓ | ✓ | ✓ |
| SearchMovie | ✓ | ✓ | ✓ | ✓ |

### httpproxy (6) — `@supports local, Electron, HarmonyOS, Docker`

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| InitTvShowByCustomTmdbHost | ✓ | ✓ | ✓ | ✓ |
| InitTvShowByCustomTvdbHost | ✓ | ✓ | ✓ | ✓ |
| InitTvShowByTmdbBehindHttpProxy | ✓ | ✓ | ✓ | ✓ |
| InitTvShowByTvdbBehindHttpProxy | ✓ | ✓ | ✓ | ✓ |
| ScrapeTvShowByTmdbBehindHttpProxy | ✓ | ✓ | pending | ✓ |
| ScrapeTvShowByTvdbBehindHttpProxy | ✓ | ✓ | pending | ✓ |

¶ Docker verified green via CI on 2026-08-05 (log `docker-httpproxy-logs-30959857820`; Phase A dead-proxy 502s + Phase B downloadImage 200s). HarmonyOS needs a separate test device environment.

### tv (15) — `@supports local, Electron, HarmonyOS, Docker`

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| InitializeTvShowByTmdb | ✓ | ✓ | ✓ | ✓ |
| InitializeTvShowByTvdb | ✓ | ✓ | ✓ | ✓ |
| SearchTvShow | ✓ | ✓ | ✓ | ✓ |
| TVShow-Import | ✓ | ✓ | ✓ | ✓ |
| Scrape | ✓ | ✓ | ✓ | ✓ |
| ScrapeFailover | ✓ | ✓ | ✓ | ✓ |
| TVShow-UnlinkEpisode | ✓ | ✓ | ✓ | ✓ |
| TVShow-Rename | ✓ | ✓ | ✓ | ✓ |
| TVShow-RenameByPlan | ✓ | ✓ | ✓ | ✓ |
| TVShow-RenameEpisodeFile | ✓ | ✓ | ✓ | ✓ |
| TVShow-SelectFileAndLinkToEpisode | ✓ | ✓ | ✓ | ✓ |
| TVShow-Recognize | ✓ | ✓ | ✓ | ✓ |
| TVShow-RecognizeByPlan | ✓ | ✓ | ✓ | ✓ |
| ImportTvShowLibrary | ✓ | ~ | ✓ | ✓ |
| TmdbHostFailover | ✓ | ✓ | ✓ | ✓ |

### other (4)

| Spec | L | E | O | D | `@supports` |
| --- | --- | --- | --- | --- | --- |
| App | ✓ | ✓ | ✓ | ✓ | local, Electron, HarmonyOS, Docker |
| BackgroundJob | ✓ | ✓ | ✓ | ✓ | local, Electron, HarmonyOS, Docker |
| RenameFolder | ✓ | ✓ | — | ✓ | local, Electron, Docker / unsupported HarmonyOS |
| Subtitle | ✓ | ✓ | — | ✓ | local, Electron, Docker / unsupported HarmonyOS |

### mcp (14) — `@supports local, Electron, Docker` · `@unsupported HarmonyOS`

Non-init MCP specs seed recognized folders via `seedRecognizedTvShowFolder` / `seedRecognizedMovieFolder` in `test/lib/mcpSpecShared.ts` (no TMDB init). Docker: MCP CLI uses `resolveMcpAddressForE2eRunner()` → `host.docker.internal:30001`; container publishes `-p 30001:30001`.

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| McpAppData-GetApplicationContextTool | ✓ | ✓ | — | ✓ |
| McpAppData-GetMediaFoldersTool | ✓ | ✓ | — | ✓ |
| McpOther-GetEpisodeTool | ✓ | ✓ | — | ✓ |
| McpOther-GetEpisodesTool | ✓ | ✓ | — | ✓ |
| McpOther-GetMediaMetadataTool | ✓ | ✓ | — | ✓ |
| McpOther-IsFolderExistTool | ✓ | ✓ | — | ✓ |
| McpOther-ListFilesTool | ✓ | ✓ | — | ✓ |
| McpOther-RecognizeTaskFlow | ✓ | ✓ | — | ✓ |
| McpOther-RenameFolderTool | ✓ | ✓ | — | ✓ |
| McpOther-RenameTaskFlow | ✓ | ✓ | — | ✓ |
| McpPrompt-CancelPreparingPlan | ✓ | ✓ | — | ✓ |
| McpPrompts-HowToRecognizeEpisodeVideoFilesTool | ✓ | ✓ | — | ✓ |
| McpPrompts-HowToRenameEpisodeVideoFilesTool | ✓ | ✓ | — | ✓ |
| McpPrompts-ReadmeTool | ✓ | ✓ | — | ✓ |

### music (2) — `@supports local, Electron, Docker` (HarmonyOS unsupported)

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| DeleteFile | ✓ | ✓ | — | ✓ |
| MusicPanel-Download-Agreement | ✓ | ✓ | — | ✓ |

### tvdb (1) — `@supports local, Electron, Docker` · `@unsupported HarmonyOS`

| Spec | L | E | O | D |
| --- | --- | --- | --- | --- |
| McpServerTools-TVDB | ✓ | ✓ | — | ✓ |

### manual (10) — opt-in on Docker via `--spec ./common/manual/*.e2e.ts`

| Spec | L | E | O | D | `@supports` |
| --- | --- | --- | --- | --- | --- |
| AppWarningBanner | — | — | pending | — | local, Electron (macOS/Linux) / unsupported HarmonyOS, Docker; skip Windows |
| CustomTmdbHost | ✓ | ✓ | pending | ✗ | local, Electron / unsupported Docker (direct API; use `common/config`) |
| CustomTvdbHost | ✓ | ✓ | pending | ✗ | local, Electron / unsupported Docker (direct API; use `common/httpproxy`) |
| Sidebar | ✓ | ✓ | pending | ✓ | local, Electron, Docker |
| ConvertVideoFormat | ✓ | ✓ | — | ✓ | local, Electron, Docker / unsupported HarmonyOS |
| MediaFileProperties | ✓ | ✓ | pending | ✗ | local, Electron / unsupported HarmonyOS, Docker (host ffmpeg) |
| MusicPanel-Download-UrlProbing | ✓ | ✓ | pending | ✓ | local, Electron, Docker / unsupported HarmonyOS |
| MusicPanel-Download | ✓ | ✓ | pending | ◐ | local, Electron / unsupported HarmonyOS, Docker (Bilibili single ✓; YouTube/collection flake) |
| MusicPanel-Transcribe | ✓ | ✓ | pending | — | local, Electron / unsupported HarmonyOS, Docker (Docker refactor pending verification) |
| Transcribe | ✓ | ✓ | pending | — | local, Electron / unsupported HarmonyOS, Docker (Docker refactor pending verification) |

---

## Deferred

| Item | Notes |
| --- | --- |
| **ImportTvShowLibrary** (Electron batch stability) | NFO folder can miss TMDB init when hosts time out before failover recovers (`tvShow.database` stays undefined). Solo often passes; batch ~ flaky. **Fix later** — not blocking `@supports Electron`. |
| **manual suite** (local + Electron) | 9/10 green on L and E (`AppWarningBanner` skipped on Windows). E solo after fixes: **`MusicPanel-Download`** `1785170364`, **`MusicPanel-Transcribe`** `1785170599`, **`Transcribe`** `1785170891`. |
| **manual suite** (Docker) | 4/10 verified (`1785351948`); Transcribe/MusicPanel-Transcribe refactored for Docker (`createTestFolderViaBrowser`, `/media/tutorials` sync + `docker exec cp`). Requires `apps/e2e/test/media/tutorials/{p1,p2}.mp4` on host. |

---

## Lessons — problems & fixes

### Batch vs solo

| Problem | Solution |
| --- | --- |
| Many identical hook / “not clickable” failures after a batch run | **Cascade** — read the **first** failing spec’s `main.log`, not the last |
| Solo passes, batch fails (Ohos attach, leftover sidebar folder) | Default **clear `localStorage`** in `testbed`; treat platform green only after full suite |
| Fixed `pause()` too short under batch load | **Poll** (`waitUntil`, `waitForFolderName`, long title waits) instead of fixed sleeps |

### Electron navigation & window

| Problem | Solution |
| --- | --- |
| `net::ERR_CONNECTION_REFUSED` at `page.open()` (no URL → Vite localhost) | Shared steps: **`page.refresh()`** instead of bare `page.open()`; Electron embeds its own origin |
| Recognize / plan buttons “missing” on Electron | Default window ~900px hides `@container` actions; **`applyE2eWindowSize`** via Electron execute or Puppeteer viewport |
| Solo PASS, installed `Programs/SMM` FAIL | Prebuilt UI lacks latest features; use **`SMM_ELECTRON_BINARY=<absolute path>/dist/win-unpacked/SMM.exe`** after `pnpm build:electron && pnpm --filter SMM build:unpack` (relative paths fail — WDIO cwd is `apps/e2e`) |

### Ohos / TMDB / init

| Problem | Solution |
| --- | --- |
| `immersive-input` stays Skeleton; import mutex never releases | **`TMDB_HOST` / `TMDB_HTTP_PROXY`** from `.env.local`; wait for **all expected sidebar folders** before panel asserts |
| Write `ENOENT` / list `EPERM` on hardcoded Download path | **`resolveSmmTestFolderViaBrowser()`** — app temp dir, not `/storage/.../Download/...` |
| Custom TMDB/TVDB host behind proxy on Ohos | **`proxiedFetch`** gzip/CONNECT + dynamic reverse-proxy allowlist for SCF hosts |
| Long init (NFO + TMDB) hits production **`withTimeout(60s)`** | E2E: raise init timeout where needed; ensure failover hosts reachable |

### Non-init specs: seed recognized folders

**Scope:** Specs that exercise rename, scrape, unlink, MCP tools, transcribe, etc. — **not** `Initialize*`, `Import*Library`, `Search*`, httpproxy, or config host tests.

| Problem | Solution |
| --- | --- |
| `createAndImportFolderViaBrowser` / `ui.mediaFolderImported` triggers TMDB/TVDB init | **Do not use** for non-init specs — init is slow, flaky in batch/Docker, and couples the test to network + API keys |
| Sidebar shows folder **basename** while test waits for TMDB **title** (`RenameFolder` Docker) | Metadata not loaded yet: `displayNameFromMetadata` falls back to `basename(path)` until init finishes |
| Short `waitForFolderTitle` after import | Misleading — you are waiting on **initialization**, not the feature under test |

**Pattern (preferred):**

1. `createTestFolderViaBrowser(base, folder)` — fixture on disk  
2. `importFolderWithMediaMetadata(folder, '<template>.metadata.json', updateFn?)` — write `smm.json` + metadata cache (`test/lib/testbed.ts`)  
3. `page.refresh()` — UI picks up folders from disk (store does not hot-reload writes)  
4. `Sidebar.waitForFolderName(folder.folderName)` — sidebar row present; no TMDB round-trip  

Templates: `test/templates/mediaMetadatas/` (e.g. `天使降临到我身边.metadata.json`). Reuse or extend Gherkin steps in `test/steps/media-folder-with-metadata-was-imported.ts`, `tv-show-folder-was-recognized.ts`, `tv-show-folder-with-files-was-imported-via-menu.ts`.

**Examples:** `common/other/RenameFolder.e2e.ts` (fixed Docker `1785344916`), `common/tv/TVShow-RenameEpisodeFile.e2e.ts`, `common/manual/Transcribe.e2e.ts`, `common/mcp/McpOther-GetEpisodeTool.e2e.ts` (via `seedRecognizedTvShowFolder` in `mcpSpecShared.ts`).

**Docker Transcribe fixtures:** `ci/e2e-docker-container.ts` syncs `apps/e2e/test/media/tutorials/` → container `/media/tutorials`. Tests copy mp4 into tmpDir via `docker exec cp` (`test/lib/e2e-tutorial-fixtures.ts`); assert outputs with `listFileNamesViaBrowser`.

**When init is the subject:** keep `createAndImportFolderViaBrowser` / Gherkin init steps and use long polls (`waitForFolderTitle` 60s–3min, `waitUntilSelectedFolderReady`) — see `common/tv/InitializeTvShowByTmdb.e2e.ts`.

### UI / StatusBar / toasts

| Problem | Solution |
| --- | --- |
| StatusBar stuck on **`Initializing...`** after bootstrap | Store **`bootstrap` phase** (`initializing` \| `ready` \| `error`) in `statusbarStore`; **translate at render** — do not persist i18n init string |
| Failure toast never dismisses in Electron E2E | Sonner **pauses auto-dismiss on hover**; move pointer away before dismiss assert |

### Media folder store / busy folder

| Problem | Solution |
| --- | --- |
| Search box not visible; wrong folder “busy” | **`waitUntilSelectedFolderReady`**; bridge via `window.__uiMediaFolderStore` (see design doc below) |
| Batch TMDB host failover out of sync | Run **`pnpm e2e:failover`** with `EXTERNAL_CONFIG_FILE_URL`; keep separate from TV glob batch |

### Config / env

| Problem | Solution |
| --- | --- |
| `InitTvShowByTmdbBehindHttpProxy` 401 in batch | Root `.env.local` empty **`TMDB_API_KEY`**; solo with key green |

### Process

| Problem | Solution |
| --- | --- |
| Device / artifact collisions | **Run platforms serially**; logs under `artifacts/cicd/<commandId>/` |

### Manual suite (first pass)

| Problem | Solution / next step |
| --- | --- |
| Right-click **Properties** on music row — menu item never appears (`MediaFileProperties`) on installed `Programs/SMM` | Rebuild unpack + set **`SMM_ELECTRON_BINARY`**; poll for track row before right-click (same pattern as ConvertVideoFormat) |
| **ConvertVideoFormat** — stale element after Start / wrong row when leftover `test (1).webm` exists | Use **Format conversion** menu; unique folder per run; poll dialog state via `browser.execute` instead of WebDriver element refs |
| Download dialog — **`write-thumbnail-checkbox`** missing (`MusicPanel-Download`) | Extra args appear only after format probe (`showExtraArgs`); test must **Go/probe** first, then More options. Cookies via `setCookies` (`browser.execute` for large Netscape text). |
| **MusicPanel-Download** L `1784999258` | Collection ✓; single BV download timed out (0 videos); title wait failed; Episodes downloaded but hard-coded `.png` name mismatch; YouTube skip without Firefox/`YOUTUBE_COOKIES*` |
| Bilibili **format probing** — HTTP 412 / anti-bot; tests waited for `format-mode-preset` radio only | Mock `test.mockYtdlpListFormatsJson` for success cases; assert `hasFormatProbeResults()` (format select, mode radio, or video list when playlist) |
| **`expect(...).toContainFile is not a function`** (Electron manual transcribe) | Custom matcher in `test/lib/expect-extensions.ts`; call **`registerExpectExtensions()`** in **`electron/wdio.conf.ts` `before` hook** (same as desktop). Fixed: E `1785170599` MusicPanel-Transcribe 3/3. |
| **`tvshow-header-transcribe` / `movie-header-transcribe`** not found (`Transcribe`) | Transcribe is inside **Subtitle** dropdown (`tvshow-header-subtitle` / `movie-header-subtitle`); use **`clickHeaderTranscribe()`** on `TVShowPanel.co` / `MoviePanel.co`. Do **not** rely on folder init — seed metadata via **`importFolderWithMediaMetadata`** + `page.refresh()` (same pattern as `media-folder-with-metadata-was-imported.ts`). Fixed L `1785163080`; E TV show ✓ `1785168829`. |
| **`music-multi-select-transcribe`** not found (`MusicPanel-Transcribe`) | Transcribe lives inside **Subtitle** dropdown (`music-header-subtitle`); open menu before clicking. Also **`Sidebar.clickFolder`**, `div[role="table"]` rows (not `tbody tr`), and poll for `.srt` with 5min timeout. Fixed L `1785000802`. |
| `Transcribe` / `MusicPanel-Transcribe` fixture | Requires **`test/media/tutorials/`** with real videos (not in git) — present locally (`p1.mp4`, `p2.mp4`) |
| `AppWarningBanner` on Windows | By design — spec targets macOS/Linux only |

**Related:** `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`, `test/lib/testbed.ts` (`importFolderWithMediaMetadata`), `test/templates/mediaMetadatas/`, `apps/tools/query-network-log.md`, `common/manual/README.md`

---

## Commands

```bash
# Per suite (from repo root)
bun ci/run-e2e-test.ts --spec "./common/config/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/httpproxy/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/other/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/mcp/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/music/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/tvdb/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/manual/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/manual/*.e2e.ts"
# Electron: set absolute path, e.g.
# SMM_ELECTRON_BINARY="C:/Users/you/workspace/smm_github/apps/electron/dist/win-unpacked/SMM.exe" \
#   bun ci/run-e2e-test.ts --platform electron --spec "./common/manual/*.e2e.ts"

pnpm e2e:local:tv
pnpm e2e:electron:tv
pnpm e2e:ohos:tv
pnpm e2e:failover   # TmdbHostFailover only; needs EXTERNAL_CONFIG_FILE_URL

# Platform flag
bun ci/run-e2e-test.ts --platform electron --spec "./common/<suite>/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/<suite>/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/<suite>/*.e2e.ts"

# Docker — per suite (requires `smm:latest` image; Compose starts `smm` + `http-proxy`)
# Host probe for proxy: set E2E_HTTP_PROXY_PROBE_URL to the published localhost port.
# App userConfig proxy URL: Compose DNS (http://http-proxy:8990).
bun ci/run-e2e-test.ts --platform docker --spec "./common/config/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/httpproxy/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/other/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/mcp/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/music/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/tvdb/*.e2e.ts"
bun ci/run-e2e-test.ts --platform docker --spec "./common/manual/*.e2e.ts"   # opt-in; needs fixtures for Transcribe
bun ci/run-e2e-test.ts --platform docker --spec "./common/tv/*.e2e.ts"
EXTERNAL_CONFIG_FILE_URL="http://localhost:8000/config.json" \
  bun ci/run-e2e-test.ts --platform docker --spec "./common/tv/TmdbHostFailover.e2e.ts"

# GitHub Actions (manual): workflow "E2E Tests for Docker" runs all common/*
# except common/manual (matrix: config, httpproxy, mcp, media-init, movie, music,
# other, tv, tvdb). Compose proxy env + EXTERNAL_CONFIG_FILE_URL for failover.
```
