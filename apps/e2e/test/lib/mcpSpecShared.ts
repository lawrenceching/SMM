import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import { delay } from 'es-toolkit'
import StatusBar from '../componentobjects/StatusBar'
import { cleanup, setup } from './testbed'

/** Set by `wdio.conf.ts` global `before` when this worker runs MCP-related specs. */
export const SMM_MCP_GLOBAL_ADDRESS_KEY = '__SMM_MCP_ADDRESS__' as const

export const SMM_MCP_WORKER_FLAG_KEY = '__SMM_MCP_WORKER_ENABLED__' as const

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
  await ensureMcpPopoverOpen()
  await StatusBar.mcpSwitch.waitForDisplayed()

  if (!(await StatusBar.isMcpToggleOn())) {
    await StatusBar.mcpSwitch.waitForClickable()
    await delay(500)
    await StatusBar.mcpSwitch.click()
    await delay(1000)
  }

  await delay(1000)
  const mcpAddress = await StatusBar.getMcpAddress()
  expect(mcpAddress).toContain('http://')
  ;(globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY] = mcpAddress
  ;(globalThis as Record<string, unknown>)[SMM_MCP_WORKER_FLAG_KEY] = true
}

/** Turn MCP server off and clear stored URL (WDIO global `after`). */
export async function disableMcpFromStatusBarAndClearGlobal(): Promise<void> {
  await ensureMcpPopoverOpen()
  await StatusBar.mcpSwitch.waitForDisplayed()

  if (await StatusBar.isMcpToggleOn()) {
    await StatusBar.mcpSwitch.click()
    await delay(1000)
  }

  delete (globalThis as Record<string, unknown>)[SMM_MCP_GLOBAL_ADDRESS_KEY]
  delete (globalThis as Record<string, unknown>)[SMM_MCP_WORKER_FLAG_KEY]
}

export function createMcpSpecContext(): McpSpecContext {
  const repoRoot = path.resolve(process.cwd(), '..', '..')
  return {
    clientCwd: path.resolve(repoRoot, 'test/mcp-test-client'),
    get mcpAddress() {
      // return getMcpAddressForWorker()
      return 'http://127.0.0.1:30001'
    },
  }
}

/** Per-test cleanup for MCP tool specs. MCP server on/off is handled in `wdio.conf.ts`. */
export function registerMcpHooks(): void {

  beforeEach(async () => {

    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
      openBrowserPage: true,
    });

    await StatusBar.mcpIndicatorButton.waitForDisplayed();
    await StatusBar.mcpIndicatorButton.click();
    await StatusBar.waitForMcpPopover(1000);
    await StatusBar.mcpSwitch.waitForDisplayed();

    // wait for a while for MCP Popover to open and load the MCP server status
    await browser.pause(1000);

    if(!await StatusBar.isMcpToggleOn()) {
      console.log('MCP switch is off, clicking to turn it on');
      await StatusBar.mcpSwitch.click();
      // wait for while for MCP server to start
      await browser.pause(1000);
    }

    if(!await StatusBar.isMcpToggleOn()) {
      console.log('[2nd check] MCP switch is still off, clicking to turn it on');
      await StatusBar.mcpSwitch.click();
      // wait for while for MCP server to start
      await browser.pause(1000);
    }

    if(!await StatusBar.isMcpToggleOn()) {
      console.log('[3rd check] MCP switch is still off, clicking to turn it on');
      await StatusBar.mcpSwitch.click();
      // wait for while for MCP server to start
      await browser.pause(1000);
    }

    
    
  })

  afterEach(async () => {
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
    })

    await browser.refresh()
    await StatusBar.appVersion.waitForDisplayed()
  })
}
