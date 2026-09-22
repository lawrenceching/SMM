import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { delay } from 'es-toolkit'
import { Path } from '@smm/utils/path'
import type { MediaMetadata } from '@smm/types'
import StatusBar from '../componentobjects/StatusBar'
import Sidebar from '../componentobjects/Sidebar'
import page from '../pageobjects/page'
import type { TestFolder } from '../actions/import-folders'
import { importFolderWithMediaMetadata } from './testbed'
import { createTestFolderViaBrowser, joinPlatformPath } from './browser-fs'
import { resolveMcpAddressForE2eRunner } from './e2e-platform'

/** Set by `wdio.conf.ts` global `before` when this worker runs MCP-related specs. */
export const SMM_MCP_GLOBAL_ADDRESS_KEY = '__SMM_MCP_ADDRESS__' as const

export const SMM_MCP_WORKER_FLAG_KEY = '__SMM_MCP_WORKER_ENABLED__' as const

export { isOhosE2e, skipIfOhos } from './e2e-platform'

export type McpSpecContext = {
  readonly clientCwd: string
  /** MCP HTTP URL from StatusBar (populated in WDIO global `before`). */
  readonly mcpAddress: string
}

export function getMcpAddressForWorker(): string {
  const addr = (globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY]
  if (typeof addr !== 'string' || !addr.includes('http://')) {
    throw new Error(
      'MCP address is not available. Ensure this worker includes MCP specs and wdio global `before` ran.',
    )
  }
  return addr
}

async function ensureMcpPopoverOpen(): Promise<void> {
  const isOpen = await StatusBar.isMcpPopoverOpen()
  if (!isOpen) {
    await StatusBar.clickMcpToggle()
  }
  const opened = await StatusBar.waitForMcpPopover(5000)
  expect(opened).toBe(true)
}

/**
 * Turn MCP server on from the StatusBar UI and store its HTTP URL on `globalThis`
 * (see {@link SMM_MCP_GLOBAL_ADDRESS_KEY}). Use after `setup()` when user config / page was reset.
 */
export async function enableMcpFromStatusBarAndStoreAddress(): Promise<void> {
  console.log('[mcpSpecShared] enableMcpFromStatusBarAndStoreAddress started')
  await ensureMcpPopoverOpen()
  await StatusBar.mcpSwitch.waitForDisplayed()

  const isOn = await StatusBar.isMcpToggleOn()
  console.log(`[mcpSpecShared] toggle aria-checked=${isOn}`)

  if (!isOn) {
    console.log('[mcpSpecShared] toggle is OFF, clicking to turn ON')
    await StatusBar.mcpSwitch.waitForClickable()
    await delay(500)
    await StatusBar.mcpSwitch.click()
    await delay(1000)
    const isOnAfter = await StatusBar.isMcpToggleOn()
    console.log(`[mcpSpecShared] after click toggle aria-checked=${isOnAfter}`)
  } else {
    console.log('[mcpSpecShared] toggle is ON, skipping click (MCP server may not be running!)')
  }

  await delay(1000)
  const mcpAddress = await StatusBar.getMcpAddress()
  console.log(`[mcpSpecShared] mcpAddress from UI = ${mcpAddress}`)
  expect(mcpAddress).toContain('http://')
  ;(globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY] = mcpAddress
  ;(globalThis as Record<string, unknown>)[SMM_MCP_WORKER_FLAG_KEY] = true
  console.log(`[mcpSpecShared] enableMcpFromStatusBarAndStoreAddress completed, stored address=${mcpAddress}`)
}

export type StopMcpViaStatusBarDeps = {
  ensurePopoverOpen: () => Promise<void>
  isOn: () => Promise<boolean>
  clickSwitch: () => Promise<void>
  waitUntilOff: (timeoutMs: number) => Promise<void>
}

/**
 * Stop MCP via StatusBar when the switch is ON.
 * CI reserves port 30001 for SMM — do not kill foreign holders; start failure is expected.
 */
export async function stopMcpViaStatusBarIfOn(
  deps: StopMcpViaStatusBarDeps,
  waitOffTimeoutMs = 10_000,
): Promise<'skipped-already-off' | 'stopped'> {
  await deps.ensurePopoverOpen()
  if (!(await deps.isOn())) {
    return 'skipped-already-off'
  }
  await deps.clickSwitch()
  await deps.waitUntilOff(waitOffTimeoutMs)
  return 'stopped'
}

async function stopMcpViaStatusBarFromUi(): Promise<'skipped-already-off' | 'stopped'> {
  return stopMcpViaStatusBarIfOn({
    ensurePopoverOpen: async () => {
      await ensureMcpPopoverOpen()
      await StatusBar.mcpSwitch.waitForDisplayed()
    },
    isOn: () => StatusBar.isMcpToggleOn(),
    clickSwitch: async () => {
      await StatusBar.mcpSwitch.waitForClickable()
      await StatusBar.mcpSwitch.click()
    },
    waitUntilOff: async (timeoutMs) => {
      await browser.waitUntil(async () => !(await StatusBar.isMcpToggleOn()), {
        timeout: timeoutMs,
        timeoutMsg: `Expected MCP switch aria-checked=false within ${timeoutMs}ms after stop click`,
        interval: 200,
      })
    },
  })
}

/** Turn MCP server off and clear stored URL (WDIO global `after`). */
export async function disableMcpFromStatusBarAndClearGlobal(): Promise<void> {
  await stopMcpViaStatusBarFromUi()

  delete (globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY]
  delete (globalThis as Record<string, unknown>)[SMM_MCP_WORKER_FLAG_KEY]
}

export function createMcpSpecContext(): McpSpecContext {
  const repoRoot = path.resolve(process.cwd(), '..', '..')
  return {
    clientCwd: path.resolve(repoRoot, 'test/mcp-test-client'),
    get mcpAddress() {
      const stored = (globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY]
      if (typeof stored === 'string' && stored.includes('http://')) {
        return stored
      }
      return resolveMcpAddressForE2eRunner()
    },
  }
}

/** Enable MCP from StatusBar after {@link setup}. Call from spec `beforeEach`. */
export async function setupMcpTest(): Promise<void> {
  console.log('[setupMcpTest] started')
  await StatusBar.mcpIndicatorButton.waitForDisplayed()
  await StatusBar.mcpIndicatorButton.click()
  await StatusBar.waitForMcpPopover(1000)
  await StatusBar.mcpSwitch.waitForDisplayed()

  await browser.pause(1000)

  for (let i = 1; i <= 3; i++) {
    const isOn = await StatusBar.isMcpToggleOn()
    console.log(`[setupMcpTest] check ${i}: toggle aria-checked=${isOn}`)
    if (isOn) {
      console.log(`[setupMcpTest] toggle ON at check ${i}, done`)
      return
    }
    console.log(`[setupMcpTest] check ${i}: toggle OFF, clicking`)
    await StatusBar.mcpSwitch.waitForClickable()
    await StatusBar.mcpSwitch.click()
    await browser.pause(1000)
  }

  const stillOff = !(await StatusBar.isMcpToggleOn())
  if (stillOff) {
    try {
      const screenshotDir = path.resolve(process.cwd(), '..', '..', 'artifacts', 'cicd')
      await fs.promises.mkdir(screenshotDir, { recursive: true })
      const screenshotPath = path.join(
        screenshotDir,
        `mcp-toggle-still-off-${Date.now()}.png`,
      )
      await browser.saveScreenshot(screenshotPath)
      console.warn(`[setupMcpTest] saved screenshot: ${screenshotPath}`)
    } catch (screenshotErr) {
      console.warn(
        '[setupMcpTest] screenshot failed:',
        screenshotErr instanceof Error ? screenshotErr.message : screenshotErr,
      )
    }
    throw new Error(
      '[setupMcpTest] MCP switch stayed aria-checked=false after 3 clicks; MCP server was not started',
    )
  }
}

/**
 * Stop MCP via StatusBar (when ON), then refresh.
 * Call from spec `afterEach` before {@link cleanup}.
 */
export async function cleanupMcpTest(): Promise<void> {
  console.log('[cleanupMcpTest] stopping MCP via StatusBar if on')
  const stopResult = await stopMcpViaStatusBarFromUi()
  console.log(`[cleanupMcpTest] stop result=${stopResult}`)

  await browser.refresh()
  await StatusBar.appVersion.waitForDisplayed()
}

const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'

/** Create fixture + seed TV show metadata (no TMDB/TVDB init). */
export async function seedRecognizedTvShowFolder(
  folder: TestFolder,
  testFolder: string,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<string> {
  const folderPath = await createTestFolderViaBrowser(testFolder, folder)
  folder.path = folderPath
  await importFolderWithMediaMetadata(folder, TV_SHOW_METADATA_TEMPLATE, updateMediaMetadata)
  await page.refresh()
  await Sidebar.waitForFolderName(folder.folderName, 60_000)
  return folderPath
}

/** Create fixture + seed movie metadata (no TMDB/TVDB init). */
export async function seedRecognizedMovieFolder(
  folder: TestFolder,
  testFolder: string,
  movie: { database: 'TMDB' | 'TVDB'; id: string; name: string },
): Promise<string> {
  const folderPath = await createTestFolderViaBrowser(testFolder, folder)
  folder.path = folderPath
  await importFolderWithMediaMetadata(folder, TV_SHOW_METADATA_TEMPLATE, (mediaMetadata) => {
    mediaMetadata.type = 'movie-folder'
    mediaMetadata.tvShow = undefined
    mediaMetadata.mediaFiles = folder.files.map((file) => ({
      absolutePath: Path.posix(joinPlatformPath(folder.path!, file)),
    }))
    mediaMetadata.movie = {
      database: movie.database,
      id: movie.id,
      name: movie.name,
    }
    return mediaMetadata
  })
  await page.refresh()
  await Sidebar.waitForFolderName(folder.folderName, 60_000)
  return folderPath
}
