import { expect } from '@wdio/globals'
import { expect as expectChai } from 'chai'
import mcpClient from 'test/lib/McpClient'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  clearFolderViaBrowser,
  createAndImportFolderViaBrowser,
  joinPlatformPath,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

describe('MCP Other - ListFilesTool', () => {
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

  it('ListFilesTool should list files from target folder', async () => {
    const folderPath = await createAndImportFolderViaBrowser(
      folder1,
      'e2eTest:ListFilesTool',
      testFolder,
    )
    const r = await mcpClient.listFiles(ctx.clientCwd, ctx.mcpAddress, {
      folderPath,
      recursive: false,
      filter: undefined,
      videoFileOnly: false,
    })

    const expectedFilePaths = folder1.files.map((file) => joinPlatformPath(folderPath, file))
    expectChai(r.files).to.have.deep.members(expectedFilePaths)
  })
})
