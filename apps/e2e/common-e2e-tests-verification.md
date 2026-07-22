# Common e2e — platform verification

Progress log for classifying `apps/e2e/common/{tv,movie}` specs on **local**,
**Electron**, and **HarmonyOS (ohos)**.

```bash
# Movie suite (serial tasks per platform):
bun ci/run-e2e-test.ts --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --platform electron --spec "./common/movie/*.e2e.ts"
bun ci/run-e2e-test.ts --platform ohos --spec "./common/movie/*.e2e.ts"

# TV suite:
pnpm e2e:local:tv
pnpm e2e:electron:tv
pnpm e2e:ohos:tv
```

## Legend

| Status | Meaning |
| --- | --- |
| **pass** | Passed on this platform run |
| **flaky** | Assertion/network flake; may pass on retry |
| **real-fail** | Failed in the recorded run (not root-caused here) |
| **pending** | Not yet verified on this platform |

---

## Movie (`common/movie`)

Batch verification **2026-07-22**. All 5 specs green on local / Electron / Ohos;
JSDoc `@supports local, Electron, HarmonyOS` added on each file.

Specs:

- `ImportMovieLibrary.e2e.ts`
- `InitializeMovieByTmdb.e2e.ts`
- `InitializeMovieByTvdb.e2e.ts`
- `Movie-RenameVideoFile.e2e.ts`
- `SearchMovie.e2e.ts`

### Local — `artifacts/cicd/1784726197` (+ init retest `1784728382`)

`bun ci/run-e2e-test.ts --spec "./common/movie/*.e2e.ts"` → initially **FAILED (4/6)** (3/5 movie).  
After wait fixes, init specs retest → **PASSED** `1784728382`.
| Spec | Classification | Notes |
| --- | --- | --- |
| ImportMovieLibrary.e2e.ts | **pass** | ~54s. `@supports local, Electron, HarmonyOS` |
| InitializeMovieByTmdb.e2e.ts | **pass** | Retest `1784728382` after wait fix: `waitForTitleToBe(..., 3min)`. Prior real-fail `1784726197` Folder Name (15s while initializing). `@supports …` |
| InitializeMovieByTvdb.e2e.ts | **pass** | Retest `1784728382`: `waitForTitleToBe` instead of `delay(10s)+getValue`. Prior real-fail `1784726197` tvdbid case. `@supports …` |
| Movie-RenameVideoFile.e2e.ts | **pass** | ~37s. `@supports …` |
| SearchMovie.e2e.ts | **pass** | ~1m32s. `@supports …` |

### Electron — `artifacts/cicd/1784726548` (+ TMDB init retest)

`bun ci/run-e2e-test.ts --platform electron --spec "./common/movie/*.e2e.ts"` → initially **FAILED (4/5)**.  
`InitializeMovieByTmdb` retest after wait fix → **PASSED** (see artifact below).

| Spec | Classification | Notes |
| --- | --- | --- |
| ImportMovieLibrary.e2e.ts | **pass** | ~1m5s (`1784726548`). `@supports …` |
| InitializeMovieByTmdb.e2e.ts | **pass** | Retest `1784729610` after `waitForTitleToBe(3min)`. Prior `1784726548`: Folder Name — `immersive-input` 15s (same as local). `@supports …` |
| InitializeMovieByTvdb.e2e.ts | **pass** | ~58s (`1784726548`). `@supports …` |
| Movie-RenameVideoFile.e2e.ts | **pass** | ~50s (`1784726548`). `@supports …` |
| SearchMovie.e2e.ts | **pass** | ~1m38s (`1784726548`). `@supports …` |

### Ohos — `artifacts/cicd/1784729938` (device connected) + follow-up fixes

Prior `1784726903` was **0/5** (device not connected / invalid session).  
Connected batch `1784729938` → **3/5**. Then:

| Spec | After fix | Artifact |
| --- | --- | --- |
| SearchMovie | **pass** | `1784731126` — title wait **3min** (folder2 has no tmdbid; Chinese case was >60s initializing) |
| Movie-RenameVideoFile | **pass** | `1784731934` — wrong id `552524`→**Lilo & Stitch**; fixed to **`615453`** + wait ready + zh-CN |

| Spec | Classification | Notes |
| --- | --- | --- |
| ImportMovieLibrary.e2e.ts | **pass** | ~1m30s (`1784729938`). `@supports … HarmonyOS` |
| InitializeMovieByTmdb.e2e.ts | **pass** | ~4m54s (`1784729938`). `@supports … HarmonyOS` |
| InitializeMovieByTvdb.e2e.ts | **pass** | ~2m33s (`1784729938`). `@supports … HarmonyOS` |
| Movie-RenameVideoFile.e2e.ts | **pass** | Retest `1784731934` after tmdbid `615453` + folder-ready wait. `@supports … HarmonyOS` |
| SearchMovie.e2e.ts | **pass** | Retest `1784731126` after `waitForTitleToBeOneOf(3min)`. `@supports … HarmonyOS` |

### Movie counts (by platform)

| Platform | pass | real-fail | Artifact |
| --- | --- | --- | --- |
| local | 5 | 0 | init retest `1784728382`; prior suite `1784726197` (3/5 before wait fix) |
| electron | 5 | 0 | TMDB init retest `1784729610`; prior suite `1784726548` (4/5 before wait fix) |
| ohos | 5 | 0 | connected `1784729938` (3/5) then Search `1784731126` + Rename pass retest |

### Movie cross-platform snapshot

| Spec | local | electron | ohos | `@supports` |
| --- | --- | --- | --- | --- |
| ImportMovieLibrary | pass (`1784726197`) | pass (`1784726548`) | pass (`1784729938`) | local, Electron, HarmonyOS |
| InitializeMovieByTmdb | pass (`1784728382`) | pass (`1784729610`) | pass (`1784729938`) | local, Electron, HarmonyOS |
| InitializeMovieByTvdb | pass (`1784728382`) | pass (`1784726548`) | pass (`1784729938`) | local, Electron, HarmonyOS |
| Movie-RenameVideoFile | pass (`1784726197`) | pass (`1784726548`) | pass (`1784731934`) | local, Electron, HarmonyOS |
| SearchMovie | pass (`1784726197`) | pass (`1784726548`) | pass (`1784731126`) | local, Electron, HarmonyOS |

---

## TV (`common/tv`)

### Electron (TV)

Baseline batch: `artifacts/cicd/1784595222` (`pnpm e2e:electron:tv`).

| Spec | Classification | Notes |
| --- | --- | --- |
| InitializeTvShowByTmdb.e2e.ts | **pass** | `@supports local, Electron, HarmonyOS` |
| InitializeTvShowByTvdb.e2e.ts | **pass** | `@supports local, Electron, HarmonyOS` |
| SearchTvShow.e2e.ts | **pass** | `@supports local, Electron, HarmonyOS`. Re-verify `1784716017` with `SMM_ELECTRON_BINARY=…/dist/win-unpacked/SMM.exe` (bridge in `resources/public`). Desktop also PASS `1784715676`. Installed `Local\Programs\SMM` without rebuild still lacks bridge (`1784713003` / `1784715006`). |
| TVShow-Import.e2e.ts | **pass** | `@supports local, Electron, HarmonyOS`. Re-verify PASS: desktop `1784716221`, Electron unpack `1784716257`. |
| Scrape.e2e.ts | **pass** | `1784599353`. `@supports local, Electron, HarmonyOS` |
| ScrapeFailover.e2e.ts | **pass** | Electron unpack `1784718190`; prior `1784599410`. `@supports …` |
| TVShow-UnlinkEpisode.e2e.ts | **pass** | `1784599498`. `@supports …` |
| TVShow-Rename.e2e.ts | **pass** | `1784600924`. `@supports …` |
| TVShow-RenameByPlan.e2e.ts | **pass** | `1784600964`. `@supports …` |
| TVShow-RenameEpisodeFile.e2e.ts | **pass** | `1784600995`. `@supports …` |
| TVShow-SelectFileAndLinkToEpisode.e2e.ts | **pass** | `1784601019`. `@supports …` |
| TVShow-Recognize.e2e.ts | **pass** | `1784603550` (window size fix). `@supports …` |
| TVShow-RecognizeByPlan.e2e.ts | **pass** | `1784603615` (window size fix). `@supports …` |
| ImportTvShowLibrary.e2e.ts | **flaky** | TMDB timeout on NFO folder (Electron). Spec still `@supports local, Electron, HarmonyOS` (ohos green). |

### Electron counts

| Classification | Count |
| --- | --- |
| pass | 13 |
| flaky | 1 |
| real-fail | 0 |

### Electron fixes (2026-07-21)

1. Shared cucumber steps call `page.refresh()` instead of `page.open()` after
   `setup({ openBrowserPage: true })`. Initial navigation stays in `setup` /
   `ensureBrowserOnUiPage` / `page is opened`.

2. Unified e2e window sizing via `test/lib/e2e-window-size.ts` in local /
   Electron / ohos WDIO `before` hooks (default 1920×1080, fit to screen).
   Electron cannot use WebDriver `setWindowSize` (`Browser.getWindowForTarget`
   missing); falls back to Puppeteer `setViewport` so container-query header
   buttons (Recognize `@[410px]`) become clickable.

---

## Ohos (HarmonyOS) — TV

Device: `hdc list targets` must show a connected device.

**Batch green (2026-07-22):** `pnpm e2e:ohos:tv` → **14/14 PASS**  
`artifacts/cicd/1784724509` (~25m wall). Prior cascade batch `1784718288`
(4/14); after localStorage default-clear `1784719636` (11/14); after Unknown
wait fix `1784721417` (13/14); TVDB wait fix → full green.

| Spec | Classification | Notes |
| --- | --- | --- |
| InitializeTvShowByTmdb.e2e.ts | **pass** | Solo `1784666434` 4/4; batch `1784724509`. Unknown: wait `immersive-input` **3min** (was 5s + pause). `@supports … HarmonyOS`. |
| InitializeTvShowByTvdb.e2e.ts | **pass** | Solo `1784666759` 3/3; batch `1784724509` (~4m24s). Title waits **3min**; TVDB ID uses `waitForTitleToBe` instead of fixed `pause(30s)`. `@supports … HarmonyOS`. |
| SearchTvShow.e2e.ts | **pass** | Solo `1784715807`; batch `1784724509`. Folder-store bridge + `waitUntilSelectedFolderReady`. `@supports … HarmonyOS`. |
| TVShow-Import.e2e.ts | **pass** | Solo `1784717979`; batch `1784724509`. Fixture root via `resolveSmmTestFolderViaBrowser` (not Download/). `@supports … HarmonyOS`. |
| Scrape.e2e.ts | **pass** | Solo + batch `1784724509`. `@supports … HarmonyOS`. |
| ScrapeFailover.e2e.ts | **pass** | Solo `1784718097`; batch `1784724509`. Was cascade trigger when `localStorage` leaked `wronghost` override. `@supports … HarmonyOS`. |
| TVShow-UnlinkEpisode.e2e.ts | **pass** | Solo `1784667132`; batch `1784724509`. `@supports … HarmonyOS`. |
| TVShow-Rename.e2e.ts | **pass** | `1784604582`; batch `1784724509`. `@supports … HarmonyOS` |
| TVShow-RenameByPlan.e2e.ts | **pass** | `1784604636`; batch `1784724509` (earlier batch flake `1784719636` wait 15s). `@supports … HarmonyOS` |
| TVShow-RenameEpisodeFile.e2e.ts | **pass** | `1784604667`; batch `1784724509`. `@supports … HarmonyOS` |
| TVShow-SelectFileAndLinkToEpisode.e2e.ts | **pass** | `1784604750`; batch `1784724509`. `@supports … HarmonyOS` |
| TVShow-Recognize.e2e.ts | **pass** | `1784604773`; batch `1784724509`. `@supports … HarmonyOS` |
| TVShow-RecognizeByPlan.e2e.ts | **pass** | `1784604819`; batch `1784724509`. `@supports … HarmonyOS` |
| ImportTvShowLibrary.e2e.ts | **pass** | Solo `1784666759`; batch `1784724509`. `@supports … HarmonyOS`. |

### Ohos counts

| Classification | Count |
| --- | --- |
| pass | 14 |
| flaky | 0 |
| real-fail | 0 |
| pending | 0 |

---

## Lessons for later platform / suite verification

Use these when a **solo** run passes but a **batch** (`e2e:ohos:*` /
`e2e:electron:*`) fails, or when Ohos attach reuses one app session.

### 1. Solo pass ≠ batch pass (Ohos attach)

Ohos WDIO attaches to a **long-lived app**. Each WDIO task is a new runner, but
UI / `localStorage` / sidebar can survive. Prefer:

1. Solo to prove the assertion.
2. Then run the **full suite** (or at least previous-spec → this-spec) before
   marking platform-green.
3. If many specs die in `before each` / `after each` with the **same** error
   (e.g. sidebar folder not clickable), treat as **cascade**, not N independent
   bugs — find the **first** real failure.

### 2. `localStorage` must be cleared by default

**Problem:** `ScrapeFailover` writes
`debug.overrideDefaultTmdbAssetServerHost=wronghost.tmdb.local`. Specs that did
not pass `clearLocalStorage: true` kept that key → later scrape/init hung;
failed cleanup left dialogs/sidebar dirty → cascade (`1784718288`).

**Fix:** `setup` / `cleanup` in `test/lib/testbed.ts` default
`clearLocalStorage: true` (clear in cleanup **and** again after
`Page.open` / `refresh`). Opt out only with explicit `false`.

**Do not** rely on each spec to remember the flag.

### 3. Setup owns environment reset

**Problem:** Expecting each test’s `afterEach` to close dialogs / delete
folders is fragile when assertions fail mid-flow.

**Approach:** Ohos/Electron `setup` already opens/refreshes the page and resets
user config. Trust that path for a clean UI; harden **defaults** in
`setup`/`cleanup` (localStorage, metadata, sidebar) rather than per-spec
tear-down tricks.

### 4. `immersive-input` missing ≠ search broken

**Problem:** `SearchTvShow` / Unknown / TVDB title waits failed with
`immersive-input` not displayed. Often the folder was still **busy**
(`initializing` / similar); `TvShowPanelHeader` hides the searchbox.

**Fix:**

- UI: `window.__uiMediaFolderStore.getSelectedFolderSnapshot()` bridge
  (`uiMediaFolderStoreBridge.ts`).
- E2E: `waitUntilSelectedFolderReady` + status-aware timeout messages
  (`test/lib/ui-media-folder-store.ts`).
- Import step `unknown-tv-show-folder-was-imported` waits for non-busy status.

When debugging, check folder **status** before assuming the selector is wrong.

### 5. Short fixed waits fail under batch load

**Problem:** Solo OK; batch after long TMDB/TVDB suites fails:

- `InitializeTvShowByTmdb` Unknown: `pause(5s)` + `waitForDisplayed(5s)`.
- `InitializeTvShowByTvdb`: `waitForTitleToBe(20s)` / `pause(30s)` then
  `getValue` without waiting for the input.

**Fix:** Prefer **long polling** (`waitForTitleToBe` / `waitForDisplayed` **3min**)
over fixed `pause`. Replace “sleep then assert” with “wait until condition”.

### 6. Fixture paths on Ohos

**Problem:** `TVShow-Import` used hardcoded
`/storage/Users/currentUser/Download/smm-test-folder` → `ENOENT` / `EPERM`.
Other specs used app temp via hello / browser FS.

**Fix:** Always `resolveSmmTestFolderViaBrowser()` (and clear that tree). Do not
hardcode Download/ on Ohos.

### 7. Electron packaged UI lag

**Problem:** Desktop/dev PASS; installed or stale `win-unpacked` fail (missing
store bridge).

**Notes:**

- Package name is `SMM` — `pnpm --filter electron` may no-op; use
  `pnpm --filter SMM run build:unpack`.
- UI ships under `resources/public`, not only asar.
- Point e2e at unpack: `SMM_ELECTRON_BINARY=…/apps/electron/dist/win-unpacked/SMM.exe`.

### 8. Run platforms serially

Parallel Ohos/Electron workers can collide on the same
`artifacts/cicd/<id>` / device port. Run one platform suite at a time.

### 9. How to classify a batch failure quickly

| Symptom | Likely cause | First check |
| --- | --- | --- |
| Many specs fail in hooks with identical “not clickable” / leftover folder name | Cascade from earlier dirty session | First ✗ task’s `main.log` |
| Scrape / TMDB asset stuck after failover-like host | `localStorage` debug override | Keys after previous ScrapeFailover |
| `immersive-input` not displayed ~5–20s | Folder still busy or wait too short | Snapshot status; extend wait / `waitUntilSelectedFolderReady` |
| `ENOENT` under Download/ | Hardcoded host path | Switch to `resolveSmmTestFolderViaBrowser` |
| Solo PASS, Electron unpack FAIL on new UI API | Stale binary | Rebuild unpack + set `SMM_ELECTRON_BINARY` |

### Related design / code

- Design: `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`
- Bridge: `apps/ui/src/stores/uiMediaFolderStoreBridge.ts`
- E2E helper: `apps/e2e/test/lib/ui-media-folder-store.ts`
- Testbed: `apps/e2e/test/lib/testbed.ts` (`clearLocalStorage` default)

---

## Historical deep-dives (kept for context)

### Ohos notes (2026-07-21 / retest 2026-07-22)

- Window sizing falls back to Puppeteer `setViewport` (same as Electron).
- Early batch leftover sidebar made later specs fail in hooks; solo re-runs used
  until suite-level localStorage/wait fixes.

### `InitializeTvShowByTmdb` deep-dive (`1784604051`)

| Case | Result | Root cause (evidence) |
| --- | --- | --- |
| TMDB ID in Folder Name | **fail** | Misnamed: folder is `天使降临到我身边！` **without** `{tmdbid=…}` → needs TMDB **search**. Frontend: `MISS` nfo/ids then `[TMDB] reverse proxy / upstream error` / failover hosts `Failed to fetch`; `onFinish status=ok` **without** `HIT: searching…` → never renamed; sidebar stayed Chinese 60s. |
| Searching Folder Name | **pass** | Uses `folder1` = `… {tmdbid=84666}` → `HIT: tmdbid in folder name` (~1.3s); English rename OK. |
| NFO | **pass** | `HIT: tvshow.nfo`. |
| Unknown | **fail** | After `MISS` ids, TMDB folder-name search hangs (no `onFinish` in log). Assert looks for `immersive-input` ~10s later → `no such element` / not displayed. Same symptom as `SearchTvShow` on ohos (search UI missing/hidden), not the EN-title assertion. |

Shared underlying issue (then): Ohos device could not reliably reach TMDB via
configured reverse-proxy / failover hosts during **folder-name search**. Id-in-name
and NFO paths that hit TMDB by id (or skip search) still worked.

### Retest after SCF timeout fix (`1784607249`)

| Case | Result | Notes |
| --- | --- | --- |
| TMDB ID in Folder Name (search) | **pass** | `HIT: searching folder name in TMDB` — previously failed |
| Searching Folder Name (tmdbid) | **pass** | unchanged |
| NFO | **fail** | Found `tmdbid in tvshow.nfo: 84666`, then ~55s of TMDB host failures (`mediadb.vercel.app` Failed to fetch; Chromium `-118` timed out); finished **without** rename → sidebar stayed `WhateverItIs…` |
| Unknown | **fail** | still no `immersive-input` |

HTTP **433 TimeLimitReached** not seen this run. SCF hosts still intermittent
(`Failed to fetch`); remaining NFO flake looked like get-by-id after reading NFO
timed out / failed to fetch rather than search miss.
