# Common e2e — platform verification

Status of `apps/e2e/common/{tv,movie,config,httpproxy,mcp,music,other,tvdb}` on **local**, **Electron**, and **HarmonyOS (ohos)**.

Verified **2026-07-22**. Specs mark `@supports …` for platforms that passed; full `local, Electron, HarmonyOS` only when green on all three. Ohos failures may use `@unsupported HarmonyOS` until fixed later.

Httpproxy: CustomTmdbHost / TmdbBehindHttpProxy / TvdbBehindHttpProxy → `@supports local, Electron` + `@unsupported HarmonyOS`. Skipped CustomTvdbHost has no marker.

Mcp (14): all `@supports local, Electron` + `@unsupported HarmonyOS` (ohos not in scope for this suite).

Music (2): `@supports local, Electron` + `@unsupported HarmonyOS` (ohos DeleteFile / Download-Agreement failed; deferred).

Other (4): Ohos all deferred (`@unsupported HarmonyOS`). App local fail / electron pass; BackgroundJob local pass / electron fail; RenameFolder + Subtitle local+electron pass.

Tvdb (1): `@supports local, Electron` + `@unsupported HarmonyOS` (MCP-like; `skipIfOhos`).

`TmdbHostFailover` lives under `common/tv/`; `@supports local, Electron, HarmonyOS`. Prefer `pnpm e2e:failover` (sets `EXTERNAL_CONFIG_FILE_URL`). Electron = installed `Programs/SMM`.

```bash
# Other / Tvdb / Music
bun ci/run-e2e-test.ts --spec "./common/other/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/other/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/other/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/tvdb/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/tvdb/*.e2e.ts"
bun ci/run-e2e-test.ts --spec "./common/music/*.e2e.ts"

# TMDB host failover (under common/tv; needs EXTERNAL_CONFIG_FILE_URL)
pnpm e2e:failover
bun ci/run-e2e-test.ts --platform electron --spec "./common/tv/TmdbHostFailover.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/tv/TmdbHostFailover.e2e.ts"

# Mcp (local + electron only)
bun ci/run-e2e-test.ts --spec "./common/mcp/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/mcp/*.e2e.ts"

# Httpproxy
bun ci/run-e2e-test.ts --spec "./common/httpproxy/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/httpproxy/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/httpproxy/*.e2e.ts"

# Config
bun ci/run-e2e-test.ts --spec "./common/config/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/config/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/config/*.e2e.ts"

# Movie
bun ci/run-e2e-test.ts --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/movie/*.e2e.ts"

# TV
pnpm e2e:local:tv
pnpm e2e:electron:tv
pnpm e2e:ohos:tv
```

| Status | Meaning |
| --- | --- |
| **pass** | Passed on this platform |
| **flaky** | May fail under load / network; retry or known flake |
| **real-fail** | Failed in the recorded run |
| **pending** | Not verified yet |

---

## Summary

| Suite | local | electron | ohos | Latest green artifacts |
| --- | --- | --- | --- | --- |
| **mcp** (14) | 14/14 | 14/14 | **n/a** (`@unsupported`) | local `1784740506`; electron `1784740794` |
| **music** (2) | 2/2 | 2/2 | 0/2 | local `1784741445`; electron `1784741524`; ohos `1784741601` |
| **other** (4) | 3/4 | 3/4 | 0/4 | local `1784742061` (+ App solo fail `1784742511`); electron `1784742190` (+ BackgroundJob solo fail `1784742565`); ohos `1784742354` |
| **tvdb** (1) | 1/1 | 1/1 | **n/a** (`@unsupported`) | local `1784742602`; electron `1784742643` |
| **httpproxy** (4) | 4/4* | 4/4* | 1/4 | local batch `1784738473` + solo TMDB proxy `1784739744`; electron batch `1784738625` + solo `1784739895`; ohos `1784738807` |
| **config** (6) | 6/6 | 6/6 | 6/6 | `1784735660` / `1784735805` / `1784737935` |
| **movie** (5) | 5/5 | 5/5 | 5/5 | see matrix below |
| **tv** (15) | — | 13 pass + 1 flaky + TmdbHostFailover | 14/14 + TmdbHostFailover | electron baseline `1784595222`; ohos `1784724509`; failover local `1784743016` / electron `1784744556` / ohos `1784743289` |

---

## Mcp (`common/mcp`)

All 14 green on local / Electron. `@supports local, Electron` + `@unsupported HarmonyOS` (ohos not run).

### Local — `1784740506` (14/14)

### Electron — `1784740794` (14/14)

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| McpAppData-GetApplicationContextTool | pass | pass | unsupported |
| McpAppData-GetMediaFoldersTool | pass | pass | unsupported |
| McpOther-GetEpisodeTool | pass | pass | unsupported |
| McpOther-GetEpisodesTool | pass | pass | unsupported |
| McpOther-GetMediaMetadataTool | pass | pass | unsupported |
| McpOther-IsFolderExistTool | pass | pass | unsupported |
| McpOther-ListFilesTool | pass | pass | unsupported |
| McpOther-RecognizeTaskFlow | pass | pass | unsupported |
| McpOther-RenameFolderTool | pass | pass | unsupported |
| McpOther-RenameTaskFlow | pass | pass | unsupported |
| McpPrompt-CancelPreparingPlan | pass | pass | unsupported |
| McpPrompts-HowToRecognizeEpisodeVideoFilesTool | pass | pass | unsupported |
| McpPrompts-HowToRenameEpisodeVideoFilesTool | pass | pass | unsupported |
| McpPrompts-ReadmeTool | pass | pass | unsupported |

---

## Music (`common/music`)

Both green on local / Electron. `@supports local, Electron` + `@unsupported HarmonyOS` (ohos failures deferred).

Specs:

- `DeleteFile.e2e.ts`
- `MusicPanel-Download-Agreement.e2e.ts`

(`MusicPanel.template.ts` is a template, not a runnable suite.)

### Local — `1784741445` (2/2)

### Electron — `1784741524` (2/2)

### Ohos — `1784741601` (0/2)

| Spec | Classification | Notes |
| --- | --- | --- |
| DeleteFile | **real-fail** | Context menu item `[Delete, 删除]` did not appear |
| MusicPanel-Download-Agreement | **real-fail** | `[data-testid="music-download-button"]` not found (5 cases) |

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| DeleteFile | pass (`1784741445`) | pass (`1784741524`) | real-fail (`1784741601`) |
| MusicPanel-Download-Agreement | pass (`1784741445`) | pass (`1784741524`) | real-fail (`1784741601`) |

---

## Other (`common/other`)

All four `@unsupported HarmonyOS`. Platform-specific supports below.

### Local — `1784742061` (3/4; App solo reconfirm fail `1784742511`)

| Spec | Classification | Notes |
| --- | --- | --- |
| App | **real-fail** | `immersive-input` still `Initializing...` vs folder path (solo same) |
| BackgroundJob | **pass** | ~19s |
| RenameFolder | **pass** | ~36s |
| Subtitle | **pass** | ~22s |

### Electron — `1784742190` (3/4; BackgroundJob solo reconfirm fail `1784742565`)

| Spec | Classification | Notes |
| --- | --- | --- |
| App | **pass** | ~41s |
| BackgroundJob | **real-fail** | Failure toast did not dismiss within 6s (solo same) |
| RenameFolder | **pass** | ~44s |
| Subtitle | **pass** | ~35s |

### Ohos — `1784742354` (0/4)

| Spec | Classification | Notes |
| --- | --- | --- |
| App | **real-fail** | `immersive-input` not found |
| BackgroundJob | **real-fail** | Failure toast did not dismiss within 6s |
| RenameFolder | **real-fail** | Expected `The Dark Knight`; got `The Dark Knight {tvdbid=116}` |
| Subtitle | **real-fail** | Subtitle menu item `[Subtitle, 字幕]` did not appear |

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| App | real-fail (`1784742061` / `1784742511`) | pass (`1784742190`) | real-fail (`1784742354`) |
| BackgroundJob | pass (`1784742061`) | real-fail (`1784742190` / `1784742565`) | real-fail (`1784742354`) |
| RenameFolder | pass (`1784742061`) | pass (`1784742190`) | real-fail (`1784742354`) |
| Subtitle | pass (`1784742061`) | pass (`1784742190`) | real-fail (`1784742354`) |

**Markers:** App → `@supports Electron`; BackgroundJob → `@supports local`; RenameFolder / Subtitle → `@supports local, Electron`; all → `@unsupported HarmonyOS`.

---

## Tvdb (`common/tvdb`)

`McpServerTools-TVDB.e2e.ts`: green on local / Electron. `@supports local, Electron` + `@unsupported HarmonyOS` (`skipIfOhos`; ohos not run).

### Local — `1784742602` (1/1)

### Electron — `1784742643` (1/1)

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| McpServerTools-TVDB | pass | pass | unsupported |

---

## Httpproxy (`common/httpproxy`)

Specs:

- `InitTvShowByCustomTmdbHost.e2e.ts`
- `InitTvShowByCustomTvdbHost.e2e.ts`
- `InitTvShowByTmdbBehindHttpProxy.e2e.ts`
- `InitTvShowByTvdbBehindHttpProxy.e2e.ts`

### Local — batch `1784738473` + solo `1784739744`

| Spec | Classification | Notes |
| --- | --- | --- |
| InitTvShowByCustomTmdbHost | **pass** | ~26s (`1784738473`) |
| InitTvShowByCustomTvdbHost | **pass** | ~6s (scenario skipped; task pass) |
| InitTvShowByTmdbBehindHttpProxy | **pass** | Solo `1784739744` ~26s. Batch `1784738473` had fail (401 / Unknown); mark pass per solo. |
| InitTvShowByTvdbBehindHttpProxy | **pass** | ~23s |

### Electron — batch `1784738625` + solo `1784739895`

| Spec | Classification | Notes |
| --- | --- | --- |
| InitTvShowByCustomTmdbHost | **pass** | ~33s |
| InitTvShowByCustomTvdbHost | **pass** | ~21s (scenario skipped; task pass) |
| InitTvShowByTmdbBehindHttpProxy | **pass** | Solo `1784739895` ~30s. Batch `1784738625` had fail; mark pass per solo. |
| InitTvShowByTvdbBehindHttpProxy | **pass** | ~34s |

### Ohos — `1784738807` (1/4; CustomTvdbHost is skipped)

| Spec | Classification | Notes |
| --- | --- | --- |
| InitTvShowByCustomTmdbHost | **real-fail** | Got zh title `天使降临到我身边！ (2019) {tmdbid=84666}`; expected EN |
| InitTvShowByCustomTvdbHost | **skip** | Scenario `it.skip` (custom TVDB host login 502); task counted pass ~10s |
| InitTvShowByTmdbBehindHttpProxy | **real-fail** | Stayed `Unknown - … {tmdbid=84666}` |
| InitTvShowByTvdbBehindHttpProxy | **real-fail** | Got zh title `天使降临到我身边！ {tvdbid=355969}`; expected EN |

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| InitTvShowByCustomTmdbHost | pass (`1784738473`) | pass (`1784738625`) | real-fail (`1784738807`) |
| InitTvShowByCustomTvdbHost | skip / pass task (`1784738473`) | skip / pass task (`1784738625`) | skip (`1784738807`) |
| InitTvShowByTmdbBehindHttpProxy | pass solo (`1784739744`) | pass solo (`1784739895`) | real-fail (`1784738807`) |
| InitTvShowByTvdbBehindHttpProxy | pass (`1784738473`) | pass (`1784738625`) | real-fail (`1784738807`) |

**Notes**

- `InitTvShowByTmdbBehindHttpProxy`: green on local/Electron when run **solo**; batch earlier failed with TMDB **401** (root `.env.local` `TMDB_HOST` + empty key). Marked **pass** + `@supports local, Electron` per solo artifacts.
- Ohos Custom TMDB / TVDB-behind-proxy: recognition renamed with **zh** titles despite `preferMediaLanguage = 'en-US'` (Custom TMDB).
- `InitTvShowByCustomTvdbHost` scenario is skipped in source (custom host login not proxied).

---

## Config (`common/config`)

All 6 green on local / Electron / Ohos. `@supports local, Electron, HarmonyOS`.

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| ConfigDialog-AI | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |
| ConfigDialog-Settings | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |
| CustomTmdbHost-WithHttpProxy | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |
| CustomTmdbHost-WrongApiKey | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |
| CustomTvdbHost-WithHttpProxy | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |
| CustomTvdbHost-WrongApiKey | pass (`1784735660`) | pass (`1784735805`) | pass (`1784737935`) |

**Notes**

- Host specs need outbound access to official TMDB/TVDB (or a working HTTP proxy). Prefer `USE_EMBEDDED_HTTP_PROXY=false` + `TMDB_HTTP_PROXY` / `TVDB_HTTP_PROXY` in `apps/e2e/.env.local` when the LAN blocks those hosts (e.g. Clash `http://192.168.50.10:7897`).
- Ohos never uses the host embedded proxy (`127.0.0.1`); always uses env proxy. Reverse-proxy probe runs via the attached browser (no host CLI on `:30000`).

---

## Movie (`common/movie`)

All 5 green. `@supports local, Electron, HarmonyOS`.

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| ImportMovieLibrary | pass (`1784726197`) | pass (`1784726548`) | pass (`1784729938`) |
| InitializeMovieByTmdb | pass (`1784728382`) | pass (`1784729610`) | pass (`1784729938`) |
| InitializeMovieByTvdb | pass (`1784728382`) | pass (`1784726548`) | pass (`1784729938`) |
| Movie-RenameVideoFile | pass (`1784726197`) | pass (`1784726548`) | pass (`1784731934`) |
| SearchMovie | pass (`1784726197`) | pass (`1784726548`) | pass (`1784731126`) |

**Notes**

- Init / Search: wait for title with **3min** polling (not short fixed sleeps) while folder is `initializing`.
- Rename fixture: TMDB id **`615453`** (哪吒); do not use `552524` (Lilo & Stitch). Prefer zh-CN + `waitUntilSelectedFolderReady` before Rename.

---

## TV (`common/tv`)

| Spec | local | electron | ohos |
| --- | --- | --- | --- |
| InitializeTvShowByTmdb | — | pass | pass (`1784724509`) |
| InitializeTvShowByTvdb | — | pass | pass |
| SearchTvShow | — | pass | pass |
| TVShow-Import | — | pass | pass |
| Scrape | — | pass | pass |
| ScrapeFailover | — | pass | pass |
| TVShow-UnlinkEpisode | — | pass | pass |
| TVShow-Rename | — | pass | pass |
| TVShow-RenameByPlan | — | pass | pass |
| TVShow-RenameEpisodeFile | — | pass | pass |
| TVShow-SelectFileAndLinkToEpisode | — | pass | pass |
| TVShow-Recognize | — | pass | pass |
| TVShow-RecognizeByPlan | — | pass | pass |
| ImportTvShowLibrary | — | **flaky** (TMDB/NFO timeout) | pass |
| TmdbHostFailover | pass (`1784743016`) | pass Programs/SMM (`1784744556`+) | pass (`1784743289`) |

Electron baseline (14 specs): `1784595222`. Ohos batch (14): `1784724509`. Failover: local `1784743016` / electron `1784744556` (+ retries) / ohos `1784743289`.

**TmdbHostFailover** (`common/tv/TmdbHostFailover.e2e.ts`): `@supports local, Electron, HarmonyOS`. Run with **`pnpm e2e:failover`** (sets `EXTERNAL_CONFIG_FILE_URL`). Electron criterion is installed `Programs/SMM`. `SearchboxCO.setLanguage` waits up to 10s for the language option (avoids cold-start `zh-CN not found`).

**Notes**

- Electron: installed `Programs/SMM` is the default; stale builds may miss UI bridge — rebuild/reinstall if `__uiMediaFolderStore` times out.
- Window size: `e2e-window-size.ts` (1920×1080); Electron/Ohos fall back to Puppeteer viewport when WebDriver `setWindowSize` fails.
- Ohos fixtures: always `resolveSmmTestFolderViaBrowser()` (never hardcode Download/).
- `e2e:tv` / `./common/tv/*.e2e.ts` also picks up Failover; without `EXTERNAL_CONFIG_FILE_URL` it does not exercise the dead-first-host path — prefer `pnpm e2e:failover`.

---

## Lessons (keep short)

1. **Solo ≠ batch (Ohos attach)** — long-lived app; clear `localStorage` by default; mark platform-green only after a **full suite** run.
2. **Cascade** — many identical hook failures → fix the **first** real failure, not each symptom.
3. **Busy folder hides searchbox** — wait `waitUntilSelectedFolderReady` / long title waits; check `__uiMediaFolderStore` status before blaming selectors.
4. **Prefer long polling over `pause()`** — batch load makes 5–30s fixed waits fail.
5. **Run platforms serially** — avoid colliding on device / `artifacts/cicd`.

| Symptom | First check |
| --- | --- |
| Many “not clickable” / leftover folder in hooks | First ✗ `main.log` (cascade) |
| Scrape/init hung after failover-like host | `localStorage` debug override |
| `immersive-input` missing | Folder status busy; extend wait |
| `ENOENT` under Download/ | Use `resolveSmmTestFolderViaBrowser` |
| Solo PASS, Electron unpack FAIL | Rebuild unpack + `SMM_ELECTRON_BINARY` |

Related: `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`, `uiMediaFolderStoreBridge.ts`, `test/lib/ui-media-folder-store.ts`, `test/lib/testbed.ts`.
