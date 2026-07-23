# Common e2e — platform verification

`apps/e2e/common/{config,movie,httpproxy,tv,other,mcp,music,tvdb}` on **local**, **Electron**, **ohos**.

Specs carry `@supports …` after green on that platform; `@unsupported HarmonyOS` when skipped by design (`skipIfOhos`). `common/manual/` is out of scope.

**Legend:** ✓ pass · ~ flaky (known; fix deferred) · — unsupported / skip · ✗ fail

---

## Suite summary

| Suite | Specs | local | electron | ohos |
| --- | ---: | --- | --- | --- |
| config | 6 | 6/6 | 6/6 | 6/6 |
| movie | 5 | 5/5 | 5/5 | 5/5 |
| httpproxy | 4 | 4/4 | 4/4 | 4/4 |
| tv | 15† | 14/14 + Failover | 14/14 + Failover‡ | 14/14 + Failover |
| other | 4 | 4/4 | 4/4 | 2/4 (+2 skip) |
| mcp | 14 | 14/14 | 14/14 | — |
| music | 2 | 2/2 | 2/2 | — |
| tvdb | 1 | 1/1 | 1/1 | — |

† 14 specs via `pnpm e2e:local:tv` / `e2e:electron:tv` / `e2e:ohos:tv`; `TmdbHostFailover` via `pnpm e2e:failover`.

‡ `ImportTvShowLibrary` ~ flaky on Electron in batch (TMDB/NFO timing); stability work **deferred** — see [Deferred](#deferred).

---

## Spec matrix

Columns: **L** local · **E** electron · **O** ohos

### config (6) — `@supports local, Electron, HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| ConfigDialog-AI | ✓ | ✓ | ✓ |
| ConfigDialog-Settings | ✓ | ✓ | ✓ |
| CustomTmdbHost-WithHttpProxy | ✓ | ✓ | ✓ |
| CustomTmdbHost-WrongApiKey | ✓ | ✓ | ✓ |
| CustomTvdbHost-WithHttpProxy | ✓ | ✓ | ✓ |
| CustomTvdbHost-WrongApiKey | ✓ | ✓ | ✓ |

### movie (5) — `@supports local, Electron, HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| ImportMovieLibrary | ✓ | ✓ | ✓ |
| InitializeMovieByTmdb | ✓ | ✓ | ✓ |
| InitializeMovieByTvdb | ✓ | ✓ | ✓ |
| Movie-RenameVideoFile | ✓ | ✓ | ✓ |
| SearchMovie | ✓ | ✓ | ✓ |

### httpproxy (4) — `@supports local, Electron, HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| InitTvShowByCustomTmdbHost | ✓ | ✓ | ✓ |
| InitTvShowByCustomTvdbHost | ✓ | ✓ | ✓ |
| InitTvShowByTmdbBehindHttpProxy | ✓ | ✓ | ✓ |
| InitTvShowByTvdbBehindHttpProxy | ✓ | ✓ | ✓ |

### tv (15) — `@supports local, Electron, HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| InitializeTvShowByTmdb | ✓ | ✓ | ✓ |
| InitializeTvShowByTvdb | ✓ | ✓ | ✓ |
| SearchTvShow | ✓ | ✓ | ✓ |
| TVShow-Import | ✓ | ✓ | ✓ |
| Scrape | ✓ | ✓ | ✓ |
| ScrapeFailover | ✓ | ✓ | ✓ |
| TVShow-UnlinkEpisode | ✓ | ✓ | ✓ |
| TVShow-Rename | ✓ | ✓ | ✓ |
| TVShow-RenameByPlan | ✓ | ✓ | ✓ |
| TVShow-RenameEpisodeFile | ✓ | ✓ | ✓ |
| TVShow-SelectFileAndLinkToEpisode | ✓ | ✓ | ✓ |
| TVShow-Recognize | ✓ | ✓ | ✓ |
| TVShow-RecognizeByPlan | ✓ | ✓ | ✓ |
| ImportTvShowLibrary | ✓ | ~ | ✓ |
| TmdbHostFailover | ✓ | ✓ | ✓ |

### other (4)

| Spec | L | E | O | `@supports` |
| --- | --- | --- | --- | --- |
| App | ✓ | ✓ | ✓ | local, Electron, HarmonyOS |
| BackgroundJob | ✓ | ✓ | ✓ | local, Electron, HarmonyOS |
| RenameFolder | ✓ | ✓ | — | local, Electron / unsupported HarmonyOS |
| Subtitle | ✓ | ✓ | — | local, Electron / unsupported HarmonyOS |

### mcp (14) — `@supports local, Electron` · `@unsupported HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| McpAppData-GetApplicationContextTool | ✓ | ✓ | — |
| McpAppData-GetMediaFoldersTool | ✓ | ✓ | — |
| McpOther-GetEpisodeTool | ✓ | ✓ | — |
| McpOther-GetEpisodesTool | ✓ | ✓ | — |
| McpOther-GetMediaMetadataTool | ✓ | ✓ | — |
| McpOther-IsFolderExistTool | ✓ | ✓ | — |
| McpOther-ListFilesTool | ✓ | ✓ | — |
| McpOther-RecognizeTaskFlow | ✓ | ✓ | — |
| McpOther-RenameFolderTool | ✓ | ✓ | — |
| McpOther-RenameTaskFlow | ✓ | ✓ | — |
| McpPrompt-CancelPreparingPlan | ✓ | ✓ | — |
| McpPrompts-HowToRecognizeEpisodeVideoFilesTool | ✓ | ✓ | — |
| McpPrompts-HowToRenameEpisodeVideoFilesTool | ✓ | ✓ | — |
| McpPrompts-ReadmeTool | ✓ | ✓ | — |

### music (2) — `@supports local, Electron` · `@unsupported HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| DeleteFile | ✓ | ✓ | — |
| MusicPanel-Download-Agreement | ✓ | ✓ | — |

### tvdb (1) — `@supports local, Electron` · `@unsupported HarmonyOS`

| Spec | L | E | O |
| --- | --- | --- | --- |
| McpServerTools-TVDB | ✓ | ✓ | — |

---

## Deferred

| Item | Notes |
| --- | --- |
| **ImportTvShowLibrary** (Electron batch stability) | NFO folder can miss TMDB init when hosts time out before failover recovers (`tvShow.database` stays undefined). Solo often passes; batch ~ flaky. **Fix later** — not blocking `@supports Electron`. |

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
| Solo PASS, installed `Programs/SMM` FAIL | Prebuilt UI lacks bridge; use **`SMM_ELECTRON_BINARY=…/dist/win-unpacked/SMM.exe`** after rebuild |

### Ohos / TMDB / init

| Problem | Solution |
| --- | --- |
| `immersive-input` stays Skeleton; import mutex never releases | **`TMDB_HOST` / `TMDB_HTTP_PROXY`** from `.env.local`; wait for **all expected sidebar folders** before panel asserts |
| Write `ENOENT` / list `EPERM` on hardcoded Download path | **`resolveSmmTestFolderViaBrowser()`** — app temp dir, not `/storage/.../Download/...` |
| Custom TMDB/TVDB host behind proxy on Ohos | **`proxiedFetch`** gzip/CONNECT + dynamic reverse-proxy allowlist for SCF hosts |
| Long init (NFO + TMDB) hits production **`withTimeout(60s)`** | E2E: raise init timeout where needed; ensure failover hosts reachable |

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

**Related:** `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`, `test/lib/testbed.ts`, `apps/tools/query-network-log.md`

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

pnpm e2e:local:tv
pnpm e2e:electron:tv
pnpm e2e:ohos:tv
pnpm e2e:failover   # TmdbHostFailover only; needs EXTERNAL_CONFIG_FILE_URL

# Platform flag
bun ci/run-e2e-test.ts --platform electron --spec "./common/<suite>/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/<suite>/*.e2e.ts"
```
