import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('MCP Prompts - ReadmeTool', () => {
  const ctx = createMcpSpecContext()

  before(function () {
    skipIfOhos(this)
  })

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
      os: testbedOs,
    })
    await setupMcpTest()
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
      os: testbedOs,
    })
  })

  it('ReadmeTool should return README markdown', async () => {
    const r = await mcpClient.readme(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('Simple Media Manager (SMM)')
    expect(r.text).toContain('## 核心概念')
  })
})
