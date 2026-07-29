import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  clearFolderViaBrowser,
  createAndImportFolderViaBrowser,
  fetchHelloPathsViaBrowser,
  joinPlatformPath,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
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
describe('MCP Other - IsFolderExistTool', () => {
  const ctx = createMcpSpecContext()
  let testFolder = ''

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

    testFolder = await resolveSmmTestFolderViaBrowser()
    await clearFolderViaBrowser(testFolder)
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
    if (testFolder) {
      await clearFolderViaBrowser(testFolder)
    }
  })

  it('IsFolderExistTool should return exists=true for existing folder', async () => {
    const { tmpDir } = await fetchHelloPathsViaBrowser()
    const inexistentPath = joinPlatformPath(tmpDir, `smm-mcp-inexistent-${Date.now()}`)
    let r = await mcpClient.isFolderExist(ctx.clientCwd, ctx.mcpAddress, { path: inexistentPath })
    expect(r.exists).toBe(false)
    expect(r.path).toBe(inexistentPath)

    const folderPath = await createAndImportFolderViaBrowser(
      folder1,
      'e2eTest:IsFolderExistTool',
      testFolder,
    )

    r = await mcpClient.isFolderExist(ctx.clientCwd, ctx.mcpAddress, { path: folderPath })
    expect(r.exists).toBe(true)
    expect(r.path).toBe(folderPath)
  })
})
