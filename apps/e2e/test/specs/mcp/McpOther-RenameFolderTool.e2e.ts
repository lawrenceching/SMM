import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as fs from 'node:fs'
import type { MediaMetadata } from '@smm/core/types'
import mcpClient from '../../lib/McpClient'
import { expectMediaMetadataToBe } from '../../lib/testbed'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - RenameFolderTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('RenameFolderTool should rename folder in file system', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:RenameFolderTool')

    // need to wait for media metadata to be saved in disk
    await browser.pause(4000);

    const newFolderName = `new-${folder.folderName}`
    const newFolderPath = path.join(path.dirname(folder.path!), newFolderName)
    const r = await mcpClient.renameFolder(ctx.clientCwd, ctx.mcpAddress, {
      from: folder.path!,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folder.path!)
    expect(r.to).toBe(newFolderPath)

    expectMediaMetadataToBe(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFolderPath === newFolderPath
    })

    expect(fs.existsSync(newFolderPath)).toBe(true)
    expect(fs.statSync(newFolderPath).isDirectory()).toBe(true)
  })
})
