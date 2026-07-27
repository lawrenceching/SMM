# Common e2e — platform verification

`apps/e2e/common/{config,movie,httpproxy,tv,other,mcp,music,tvdb,manual}` on **local**, **Electron**, **ohos**.

Specs carry `@supports …` after green on that platform; `@unsupported HarmonyOS` when skipped by design (`skipIfOhos`). `common/manual/` is on-demand (yt-dlp, ffmpeg, transcription); excluded from default CI unless `--spec` targets it explicitly.

**Legend:** ✓ pass · ~ flaky (known; fix deferred) · — unsupported / skip · ✗ fail · ◐ partial (spec fails; some `it` pass)

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
| **manual** | 10 | 6/10§ | 6/10§ | pending |

§ Ohos not verified yet. Windows skips `AppWarningBanner` (macOS/Linux-only). No `@supports` markers until green.

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

### manual (10) — no `@supports` yet (verification in progress)

| Spec | L | E | O | Notes |
| --- | --- | --- | --- | --- |
| AppWarningBanner | — | — | pending | Windows: entire spec skipped (macOS/Linux banner) |
| CustomTmdbHost | ✓ | ✓ | pending | |
| CustomTvdbHost | ✓ | ✓ | pending | |
| Sidebar | ✓ | ✓ | pending | 4/4 `it` |
| ConvertVideoFormat | ✓ | ✓ | — | `@supports local, Electron` · `@unsupported HarmonyOS` (host ffmpeg + `skipIfOhos`) |
| MediaFileProperties | ✓ | ✓ | pending | `@supports local, Electron` · `@unsupported HarmonyOS` · Electron needs **`SMM_ELECTRON_BINARY=…/dist/win-unpacked/SMM.exe`** after rebuild |
| MusicPanel-Download-UrlProbing | ✓ | ✓ | pending | `@supports local, Electron` · mock `test.mockYtdlpListFormatsJson` for Bilibili success path |
| MusicPanel-Download | ◐ | pending | pending | L `1784999258`: Collection ✓; single video 0 files / title timeout / Episodes `.png` name mismatch; YouTube skip (no Firefox cookies). Probe+cookies path OK. |
| MusicPanel-Transcribe | ✓ | pending | pending | L `1785000802`: 3/3 pass after CO selector fix (`div[role="table"]`), `Sidebar.clickFolder`, subtitle dropdown + TranscribeDialog confirm, poll for `.srt`. |
| Transcribe | ✗ | ✗ | pending | `*-header-transcribe` not found (viewport / feature flag?) |

---

## Deferred

| Item | Notes |
| --- | --- |
| **ImportTvShowLibrary** (Electron batch stability) | NFO folder can miss TMDB init when hosts time out before failover recovers (`tvShow.database` stays undefined). Solo often passes; batch ~ flaky. **Fix later** — not blocking `@supports Electron`. |
| **manual suite** (local + Electron) | See **Manual suite (first pass)** under Lessons — context menu, download dialog, transcribe headers, Bilibili probe. Fix in follow-up tasks. |

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
| Solo PASS, installed `Programs/SMM` FAIL | Prebuilt UI lacks latest features; use **`SMM_ELECTRON_BINARY=…/dist/win-unpacked/SMM.exe`** after `pnpm build:electron && pnpm --filter SMM build:unpack` |

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

### Manual suite (first pass)

| Problem | Solution / next step |
| --- | --- |
| Right-click **Properties** on music row — menu item never appears (`MediaFileProperties`) on installed `Programs/SMM` | Rebuild unpack + set **`SMM_ELECTRON_BINARY`**; poll for track row before right-click (same pattern as ConvertVideoFormat) |
| **ConvertVideoFormat** — stale element after Start / wrong row when leftover `test (1).webm` exists | Use **Format conversion** menu; unique folder per run; poll dialog state via `browser.execute` instead of WebDriver element refs |
| Download dialog — **`write-thumbnail-checkbox`** missing (`MusicPanel-Download`) | Extra args appear only after format probe (`showExtraArgs`); test must **Go/probe** first, then More options. Cookies via `setCookies` (`browser.execute` for large Netscape text). |
| **MusicPanel-Download** L `1784999258` | Collection ✓; single BV download timed out (0 videos); title wait failed; Episodes downloaded but hard-coded `.png` name mismatch; YouTube skip without Firefox/`YOUTUBE_COOKIES*` |
| Bilibili **format probing** — HTTP 412 / anti-bot; tests waited for `format-mode-preset` radio only | Mock `test.mockYtdlpListFormatsJson` for success cases; assert `hasFormatProbeResults()` (format select, mode radio, or video list when playlist) |
| **`tvshow-header-transcribe` / `movie-header-transcribe`** not found (`Transcribe`) | Same class as TV Recognize: widen viewport or enable transcribe in test config |
| **`music-multi-select-transcribe`** not found (`MusicPanel-Transcribe`) | Transcribe lives inside **Subtitle** dropdown (`music-header-subtitle`); open menu before clicking. Also **`Sidebar.clickFolder`**, `div[role="table"]` rows (not `tbody tr`), and poll for `.srt` with 5min timeout. Fixed L `1785000802`. |
| `MusicPanel-Transcribe` fixture | Requires **`test/media/tutorials/`** with real videos (not in git) — present locally (`p1.mp4`, `p2.mp4`) |
| `AppWarningBanner` on Windows | By design — spec targets macOS/Linux only |

**Related:** `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`, `test/lib/testbed.ts`, `apps/tools/query-network-log.md`, `common/manual/README.md`

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

pnpm e2e:local:tv
pnpm e2e:electron:tv
pnpm e2e:ohos:tv
pnpm e2e:failover   # TmdbHostFailover only; needs EXTERNAL_CONFIG_FILE_URL

# Platform flag
bun ci/run-e2e-test.ts --platform electron --spec "./common/<suite>/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/<suite>/*.e2e.ts"
```
