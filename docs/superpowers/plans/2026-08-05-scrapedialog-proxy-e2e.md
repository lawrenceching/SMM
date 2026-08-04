# ScrapeDialog HTTP Proxy E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add common e2e specs verifying ScrapeDialog image downloads go through the configured HTTP proxy, then verify on local → electron → docker.

**Architecture:** Two self-contained specs in `apps/e2e/common/httpproxy/` run a two-phase scenario: (A) dead proxy → assert all scrape tasks FAIL (deterministic proof the proxy is wired); (B) fix proxy → assert all tasks COMPLETE and files land on disk. A `data-status` attribute on the ScrapeDialog status cell lets the new "failed" step assert deterministically (failed tasks render a localized error, not the literal "Failed").

**Tech Stack:** WebdriverIO e2e (Mocha BDD + Gherkin steps), Vitest (UI unit test), Bun scripts (`ci/run-e2e-test.ts`), proxy-chain (embedded HTTP proxy).

**Spec:** `docs/superpowers/specs/2026-08-05-scrapedialog-proxy-e2e-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `apps/ui/src/components/dialogs/UIScrapeDialogTable.tsx` | Add `data-status={task.status}` to status cell (Task 1) |
| `apps/ui/src/components/dialogs/UIScrapeDialog.test.tsx` | Unit test for `data-status` (Task 1) |
| `apps/e2e/test/steps/scrape-dialog-steps.ts` | New step `scrape dialog shows all TV show tasks failed` (Task 2) |
| `apps/e2e/common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts` | TMDB TV-show two-phase spec (Task 3) |
| `apps/e2e/common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts` | TVDB TV-show two-phase spec (Task 4) |
| `apps/e2e/common-e2e-tests-verification.md` | Update httpproxy matrix after green runs (Task 8) |

---

### Task 1: Add `data-status` attribute to ScrapeDialog status cell

**Files:**
- Modify: `apps/ui/src/components/dialogs/UIScrapeDialogTable.tsx:53-66`
- Test: `apps/ui/src/components/dialogs/UIScrapeDialog.test.tsx`

- [ ] **Step 1: Write the failing unit test**

Append this `it` block inside `describe("UIScrapeDialog", () => {` in `apps/ui/src/components/dialogs/UIScrapeDialog.test.tsx` (after the existing "invokes onStart when start is clicked" test, before the closing `})`):

```tsx
  it("exposes data-status on each task status cell", () => {
    const tasks: ScrapeTaskView[] = [
      { id: "poster", status: "failed", failedReason: "scrape.errors.tmdbUnavailable" },
      { id: "fanart", status: "pending" },
      { id: "thumbnails", status: "running" },
      { id: "nfo", status: "completed" },
    ]

    render(
      <UIScrapeDialog
        isOpen
        onClose={onClose}
        tasks={tasks}
        isRunning={false}
        allTasksDone={false}
        showButtons
        cancelDisabled={false}
        canDismissIncidentally={false}
        onCancel={onCancel}
        onStart={onStart}
      />,
    )

    expect(screen.getByTestId("scrape-dialog-task-status-poster").getAttribute("data-status")).toBe("failed")
    expect(screen.getByTestId("scrape-dialog-task-status-fanart").getAttribute("data-status")).toBe("pending")
    expect(screen.getByTestId("scrape-dialog-task-status-thumbnails").getAttribute("data-status")).toBe("running")
    expect(screen.getByTestId("scrape-dialog-task-status-nfo").getAttribute("data-status")).toBe("completed")
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ui test UIScrapeDialog`
Expected: FAIL — `getAttribute("data-status")` returns `null` because the attribute does not exist yet.

- [ ] **Step 3: Add the attribute**

In `apps/ui/src/components/dialogs/UIScrapeDialogTable.tsx`, the status cell `<div>` at line 54-57 currently reads:

```tsx
        <div
          className="flex items-center gap-2"
          data-testid={`scrape-dialog-task-status-${task.id}`}
        >
```

Change it to:

```tsx
        <div
          className="flex items-center gap-2"
          data-testid={`scrape-dialog-task-status-${task.id}`}
          data-status={task.status}
        >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter ui test UIScrapeDialog`
Expected: PASS (all `data-status` assertions green).

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/dialogs/UIScrapeDialogTable.tsx apps/ui/src/components/dialogs/UIScrapeDialog.test.tsx
git commit -m "feat(ui): expose scrape task status via data-status attribute for e2e"
```

---

### Task 2: Add `scrape dialog shows all TV show tasks failed` step

**Files:**
- Modify: `apps/e2e/test/steps/scrape-dialog-steps.ts`

- [ ] **Step 1: Add the step**

In `apps/e2e/test/steps/scrape-dialog-steps.ts`, after the existing `registerStep('scrape dialog shows all TV show tasks completed', ...)` block (ends ~line 104), add:

```ts
registerStep('scrape dialog shows all TV show tasks failed', async () => {
    await browser.waitUntil(async () => {
        const ids = ['poster', 'fanart', 'thumbnails', 'nfo']
        const results = await Promise.all(ids.map(async (id) => {
            const el = $(`[data-testid="scrape-dialog-task-status-${id}"]`)
            return (await el.getAttribute('data-status')) === 'failed'
        }))
        return results.every(Boolean)
    }, {
        timeout: 60 * 1000,
        interval: 1000,
        timeoutMsg: 'ScrapeDialog tasks did not all fail',
    })
})
```

Note: this relies on the `data-status` attribute from Task 1. It cannot match on text — a failed task renders a localized error (`localizeScrapeError(task.failedReason)`), not the literal "Failed".

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/test/steps/scrape-dialog-steps.ts
git commit -m "test(e2e): add step asserting all scrape tasks failed"
```

---

### Task 3: TMDB TV-show spec

**Files:**
- Create: `apps/e2e/common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts`

- [ ] **Step 1: Write the spec**

Create `apps/e2e/common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts` with this exact content:

```ts
import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    isHttpProxyAccessible,
    useEmbeddedHttpProxy,
    startEmbeddedHttpProxy,
    stopEmbeddedHttpProxy,
    getConfiguredHttpProxyAddress,
    DEFAULT_EMBEDDED_PROXY_ADDRESS,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    fileExistsViaBrowser,
    getFileSizeViaBrowser,
    joinPlatformPath,
    listFilesViaBrowser,
    readFileViaBrowser,
    resolveSmmTestFolderViaBrowser,
    basenamePlatformPath,
    updateUserConfigViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { UserConfig } from '@smm/core/types'
import { env } from 'node:process'
import { testbedOs } from 'test/lib/e2e-platform'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

// Intentionally dead proxy: port 1 is closed on every host / container /
// device, so any request routed through it fails fast with ECONNREFUSED.
// If scrape did NOT route through the configured proxy, this dead address
// would be ignored and scrape would succeed on an open network — so a
// failure here deterministically proves the proxy is wired.
const WRONG_HTTP_PROXY = 'http://127.0.0.1:1'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function getImagePathWithPrefix(folderPath: string, prefix: string): Promise<string | undefined> {
    const items = await listFilesViaBrowser(folderPath)
    const match = items.find((item) => {
        if (item.isDirectory) return false
        const name = basenamePlatformPath(item.path)
        return (
            name.startsWith(`${prefix}.`) &&
            IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        )
    })
    return match?.path
}

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Scrape TV Show via TMDB Behind HTTP Proxy', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }

        if (useEmbeddedHttpProxy()) {
            await startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS)
        } else {
            const tmdbHttpProxy = (process.env.TMDB_HTTP_PROXY || '').trim()
            if (!tmdbHttpProxy) {
                throw new Error('TMDB_HTTP_PROXY is not set in the e2e environment')
            }
            const httpProxyUp = await isHttpProxyAccessible(tmdbHttpProxy)
            if (!httpProxyUp) {
                throw new Error(`TMDB HTTP proxy is not reachable: ${tmdbHttpProxy}`)
            }
        }
    })

    after(async () => {
        await stopEmbeddedHttpProxy()
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tmdb = {
                    host: 'https://api.themoviedb.org/3',
                    apiKey: process.env.TMDB_API_KEY || '',
                    httpProxy: WRONG_HTTP_PROXY,
                }
                config.preferMediaLanguage = 'zh-CN'
                return config
            },
            os: testbedOs,
        })
        resetStepContext()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Scenario: TV show scraped via TMDB behind HTTP proxy (dead proxy fails, live proxy succeeds)', async function () {
        this.timeout(240 * 1000)

        // Phase A — dead proxy: scrape must FAIL (proves the proxy is wired).
        await given('TV show folder with TMDB id 84666 and one episode was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks failed')
        await when('I close scrape dialog')

        // Phase B — fix the proxy to the working one, scrape again: must succeed.
        const liveProxy = getConfiguredHttpProxyAddress('tmdb')
        if (!liveProxy) {
            throw new Error('No working TMDB HTTP proxy available for Phase B')
        }
        await updateUserConfigViaBrowser((config: UserConfig) => {
            if (config.tmdb) {
                config.tmdb.httpProxy = liveProxy
            }
            return config
        })
        await page.refresh()

        const folder = getStepContext()._folder as {
            folderName: string
            translations?: { title?: Record<string, string> }
        }
        await Sidebar.waitForFolderName(folder.folderName)

        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TMDB TV show scrape outputs are written to disk', async () => {
            const folderPath = (getStepContext()._folder as { path: string }).path

            const thumbnailPath = joinPlatformPath(folderPath, 'S01E01.jpg')
            expect(await fileExistsViaBrowser(thumbnailPath)).toBe(true)
            expect(await getFileSizeViaBrowser(thumbnailPath)).toBeGreaterThan(0)

            const posterPath = await getImagePathWithPrefix(folderPath, 'poster')
            const fanartPath = await getImagePathWithPrefix(folderPath, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(await getFileSizeViaBrowser(posterPath!)).toBeGreaterThan(0)
            expect(await getFileSizeViaBrowser(fanartPath!)).toBeGreaterThan(0)
            expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, 'S01E02.jpg'))).toBe(false)

            const tvshowNfoPath = joinPlatformPath(folderPath, 'tvshow.nfo')
            expect(await fileExistsViaBrowser(tvshowNfoPath)).toBe(true)
            expect(await readFileViaBrowser(tvshowNfoPath)).toContain('天使降临到我身边')

            const s01e01EpisodeNfoPath = joinPlatformPath(folderPath, 'S01E01.nfo')
            expect(await fileExistsViaBrowser(s01e01EpisodeNfoPath)).toBe(true)
            expect(await getFileSizeViaBrowser(s01e01EpisodeNfoPath)).toBeGreaterThan(0)
            expect(await readFileViaBrowser(s01e01EpisodeNfoPath)).toContain('心里痒痒的感觉')
        })

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})
```

- [ ] **Step 2: Typecheck the spec**

Run: `pnpm -C apps/e2e typecheck`
Expected: no new type errors introduced by the spec.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts
git commit -m "test(e2e): add TMDB TV-show scrape-through-proxy spec (dead then live proxy)"
```

---

### Task 4: TVDB TV-show spec

**Files:**
- Create: `apps/e2e/common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts`

- [ ] **Step 1: Write the spec**

Create `apps/e2e/common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts` with this exact content (same as Task 3 except: `describe` title, `config.tvdb` block, TVDB seed step, `getConfiguredHttpProxyAddress('tvdb')`, TVDB nfo assertions):

```ts
import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    isHttpProxyAccessible,
    useEmbeddedHttpProxy,
    startEmbeddedHttpProxy,
    stopEmbeddedHttpProxy,
    getConfiguredHttpProxyAddress,
    DEFAULT_EMBEDDED_PROXY_ADDRESS,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    fileExistsViaBrowser,
    getFileSizeViaBrowser,
    joinPlatformPath,
    listFilesViaBrowser,
    readFileViaBrowser,
    resolveSmmTestFolderViaBrowser,
    basenamePlatformPath,
    updateUserConfigViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { UserConfig } from '@smm/core/types'
import { env } from 'node:process'
import { testbedOs } from 'test/lib/e2e-platform'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

// Intentionally dead proxy: port 1 is closed on every host / container /
// device, so any request routed through it fails fast with ECONNREFUSED.
const WRONG_HTTP_PROXY = 'http://127.0.0.1:1'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function getImagePathWithPrefix(folderPath: string, prefix: string): Promise<string | undefined> {
    const items = await listFilesViaBrowser(folderPath)
    const match = items.find((item) => {
        if (item.isDirectory) return false
        const name = basenamePlatformPath(item.path)
        return (
            name.startsWith(`${prefix}.`) &&
            IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        )
    })
    return match?.path
}

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Scrape TV Show via TVDB Behind HTTP Proxy', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }

        if (useEmbeddedHttpProxy()) {
            await startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS)
        } else {
            const tvdbHttpProxy = (process.env.TVDB_HTTP_PROXY || '').trim()
            if (!tvdbHttpProxy) {
                throw new Error('TVDB_HTTP_PROXY is not set in the e2e environment')
            }
            const httpProxyUp = await isHttpProxyAccessible(tvdbHttpProxy)
            if (!httpProxyUp) {
                throw new Error(`TVDB HTTP proxy is not reachable: ${tvdbHttpProxy}`)
            }
        }
    })

    after(async () => {
        await stopEmbeddedHttpProxy()
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tvdb = {
                    host: 'https://api4.thetvdb.com/v4',
                    apiKey: process.env.TVDB_API_KEY || '',
                    httpProxy: WRONG_HTTP_PROXY,
                }
                config.preferMediaLanguage = 'zh-CN'
                return config
            },
            os: testbedOs,
        })
        resetStepContext()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Scenario: TV show scraped via TVDB behind HTTP proxy (dead proxy fails, live proxy succeeds)', async function () {
        this.timeout(240 * 1000)

        // Phase A — dead proxy: scrape must FAIL (proves the proxy is wired).
        await given('TV show folder with TVDB id 355969 and one episode was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks failed')
        await when('I close scrape dialog')

        // Phase B — fix the proxy to the working one, scrape again: must succeed.
        const liveProxy = getConfiguredHttpProxyAddress('tvdb')
        if (!liveProxy) {
            throw new Error('No working TVDB HTTP proxy available for Phase B')
        }
        await updateUserConfigViaBrowser((config: UserConfig) => {
            if (config.tvdb) {
                config.tvdb.httpProxy = liveProxy
            }
            return config
        })
        await page.refresh()

        const folder = getStepContext()._folder as {
            folderName: string
            translations?: { title?: Record<string, string> }
        }
        await Sidebar.waitForFolderName(folder.folderName)

        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TVDB TV show scrape outputs are written to disk', async () => {
            const folderPath = (getStepContext()._folder as { path: string }).path

            const thumbnailPath = joinPlatformPath(folderPath, 'S01E01.jpg')
            expect(await fileExistsViaBrowser(thumbnailPath)).toBe(true)
            expect(await getFileSizeViaBrowser(thumbnailPath)).toBeGreaterThan(0)

            const posterPath = await getImagePathWithPrefix(folderPath, 'poster')
            const fanartPath = await getImagePathWithPrefix(folderPath, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(await getFileSizeViaBrowser(posterPath!)).toBeGreaterThan(0)
            expect(await getFileSizeViaBrowser(fanartPath!)).toBeGreaterThan(0)
            expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, 'S01E02.jpg'))).toBe(false)

            const tvshowNfoPath = joinPlatformPath(folderPath, 'tvshow.nfo')
            expect(await fileExistsViaBrowser(tvshowNfoPath)).toBe(true)
            expect(await readFileViaBrowser(tvshowNfoPath)).toContain('天使降临到了我身边')

            const s01e01EpisodeNfoPath = joinPlatformPath(folderPath, 'S01E01.nfo')
            expect(await fileExistsViaBrowser(s01e01EpisodeNfoPath)).toBe(true)
            expect(await getFileSizeViaBrowser(s01e01EpisodeNfoPath)).toBeGreaterThan(0)
            expect(await readFileViaBrowser(s01e01EpisodeNfoPath)).toContain('心裏癢癢的感覺')
            expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, 'S01E02.nfo'))).toBe(false)
        })

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})
```

- [ ] **Step 2: Typecheck the spec**

Run: `pnpm -C apps/e2e typecheck`
Expected: no new type errors introduced by the spec.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts
git commit -m "test(e2e): add TVDB TV-show scrape-through-proxy spec (dead then live proxy)"
```

---

### Task 5: Verify on local

Runs the Vite dev UI (`pnpm dev:ui`) + CLI; embedded proxy-chain starts automatically on local (default `USE_EMBEDDED_HTTP_PROXY=true`). Requires `TMDB_API_KEY` / `TVDB_API_KEY` set in env (confirmed present in `apps/e2e/.env.local`).

- [ ] **Step 1: Run TMDB spec on local**

From repo root:

```bash
bun ci/run-e2e-test.ts --spec "./common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts"
```

Expected: PASS — Phase A shows all four tasks `data-status="failed"`, Phase B completes and poster/fanart/S01E01.jpg/tvshow.nfo/S01E01.nfo are written.

If Phase A fails to reach "failed" within 60s: check the reverse proxy is routing `X-Http-Proxy` (see `apps/cli/server.ts` `buildReverseProxyConfig` returns `createProxiedFetch`). If the test reports the dead proxy was bypassed (scrape succeeded), the app is not honoring `httpProxy` — investigate the proxy-resolution wiring.

- [ ] **Step 2: Run TVDB spec on local**

```bash
bun ci/run-e2e-test.ts --spec "./common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts"
```

Expected: PASS (same shape, TVDB assertions).

- [ ] **Step 3: Commit any fixes made during verification**

If the test exposed a product bug, fix it (TDD), commit the fix, then re-run Step 1/Step 2 to green.

---

### Task 6: Verify on electron

Requires a rebuilt Electron binary that includes the Task 1 `data-status` change (the existing `apps/electron/dist/win-unpacked/SMM.exe` predates it).

- [ ] **Step 1: Rebuild the Electron binary**

From repo root:

```bash
pnpm build:electron
pnpm --filter SMM build:unpack
```

Expected: `apps/electron/dist/win-unpacked/SMM.exe` regenerated. Verify the file timestamp is fresh (`ls -la apps/electron/dist/win-unpacked/SMM.exe`).

- [ ] **Step 2: Run TMDB spec on electron**

```bash
SMM_ELECTRON_BINARY="C:/Users/lawrence/workspace/smm_github/apps/electron/dist/win-unpacked/SMM.exe" \
  bun ci/run-e2e-test.ts --platform electron --spec "./common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts"
```

Expected: PASS.

- [ ] **Step 3: Run TVDB spec on electron**

```bash
SMM_ELECTRON_BINARY="C:/Users/lawrence/workspace/smm_github/apps/electron/dist/win-unpacked/SMM.exe" \
  bun ci/run-e2e-test.ts --platform electron --spec "./common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts"
```

Expected: PASS.

- [ ] **Step 4: Commit any fixes made during verification**

---

### Task 7: Verify on docker

Requires Docker Desktop running and a `smm:latest` image rebuilt to include the Task 1 change (the current image predates it).

- [ ] **Step 1: Preflight — Docker daemon running**

Run: `docker images smm:latest --format "{{.ID}}"`
Expected: an image ID prints. If it errors "failed to connect to the docker API", start Docker Desktop first and wait for the engine.

- [ ] **Step 2: Rebuild `smm:latest`**

From repo root:

```bash
pnpm -C apps/docker build
```

Expected: `docker buildx build -t smm:latest -f Dockerfile ../..` succeeds and prints `naming to docker.io/library/smm:latest`.

- [ ] **Step 3: Run TMDB spec on docker**

```bash
bun ci/run-e2e-test.ts --platform docker --spec "./common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts"
```

Expected: PASS. Note the runner rewrites `TMDB_HTTP_PROXY` `127.0.0.1` → `host.docker.internal`; the hardcoded `WRONG_HTTP_PROXY` (`http://127.0.0.1:1`) stays as-is and resolves to the container itself (ECONNREFUSED).

- [ ] **Step 4: Run TVDB spec on docker**

```bash
bun ci/run-e2e-test.ts --platform docker --spec "./common/httpproxy/ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts"
```

Expected: PASS.

- [ ] **Step 5: Commit any fixes made during verification**

---

### Task 8: Update the e2e verification matrix

**Files:**
- Modify: `apps/e2e/common-e2e-tests-verification.md`

- [ ] **Step 1: Add the two specs to the httpproxy suite table**

In `apps/e2e/common-e2e-tests-verification.md`, `### httpproxy (4)` section, change the heading to `### httpproxy (6)` and append two rows to the table:

```markdown
| ScrapeTvShowByTmdbBehindHttpProxy | ✓ | ✓ | ✓ | ✓ |
| ScrapeTvShowByTvdbBehindHttpProxy | ✓ | ✓ | ✓ | ✓ |
```

Mark ✓ only for platforms actually verified green (local / electron / docker per Tasks 5-7; HarmonyOS pending — mark the ohos column `—` until verified, and update the "Suite summary" `httpproxy` row counts accordingly).

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/common-e2e-tests-verification.md
git commit -m "docs(e2e): record scrape-through-proxy httpproxy specs in verification matrix"
```

---

## Self-Review Notes

- **Spec coverage:** §4 flow → Task 3/4; §5.1 `data-status` → Task 1; §5.2 step → Task 2; §7 verification (local/electron/docker) → Tasks 5/6/7; §8 non-goals (movie, proxy observation, Scrape.e2e.ts changes) — not implemented. HarmonyOS deferred per user.
- **Type consistency:** `data-status={task.status}` uses `ScrapeTaskStatus`; the step reads `data-status` === "failed"; `ScrapeTaskView` has `failedReason?: string`. Spec files use only functions exported from `test/lib/testbed` / `test/lib/browser-fs` / `test/lib/gherkin` confirmed present.
- **Env deps:** `TMDB_API_KEY`/`TVDB_API_KEY` confirmed set in `apps/e2e/.env.local`. `USE_EMBEDDED_HTTP_PROXY` defaults to `true` on local/electron; Docker/ohos require `TMDB_HTTP_PROXY`/`TVDB_HTTP_PROXY` env (confirmed set).
