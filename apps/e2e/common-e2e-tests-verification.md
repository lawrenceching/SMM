# Common e2e — platform verification

Status of `apps/e2e/common/{tv,movie,config}` on **local**, **Electron**, and **HarmonyOS (ohos)**.

Verified **2026-07-22**. Specs mark `@supports local, Electron, HarmonyOS` when green on all three.

```bash
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
| **config** (6) | 6/6 | 6/6 | 6/6 | `1784735660` / `1784735805` / `1784737935` |
| **movie** (5) | 5/5 | 5/5 | 5/5 | see matrix below |
| **tv** (14) | — | 13 pass + 1 flaky | 14/14 | electron baseline `1784595222`; ohos `1784724509` |

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

| Spec | electron | ohos |
| --- | --- | --- |
| InitializeTvShowByTmdb | pass | pass (`1784724509`) |
| InitializeTvShowByTvdb | pass | pass |
| SearchTvShow | pass | pass |
| TVShow-Import | pass | pass |
| Scrape | pass | pass |
| ScrapeFailover | pass | pass |
| TVShow-UnlinkEpisode | pass | pass |
| TVShow-Rename | pass | pass |
| TVShow-RenameByPlan | pass | pass |
| TVShow-RenameEpisodeFile | pass | pass |
| TVShow-SelectFileAndLinkToEpisode | pass | pass |
| TVShow-Recognize | pass | pass |
| TVShow-RecognizeByPlan | pass | pass |
| ImportTvShowLibrary | **flaky** (Electron TMDB/NFO timeout) | pass |

Electron baseline: `1784595222` (re-verifies for Search/Import/ScrapeFailover on unpack). Ohos batch: **14/14** `1784724509`.

**Notes**

- Electron: use unpack binary with UI bridge (`SMM_ELECTRON_BINARY=…/dist/win-unpacked/SMM.exe`); installed stale builds may miss bridge.
- Window size: `e2e-window-size.ts` (1920×1080); Electron/Ohos fall back to Puppeteer viewport when WebDriver `setWindowSize` fails.
- Ohos fixtures: always `resolveSmmTestFolderViaBrowser()` (never hardcode Download/).

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
