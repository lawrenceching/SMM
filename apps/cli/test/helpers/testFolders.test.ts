import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests, smm } from './smm'
import { createAndImportInitializedFolder, musicFolder } from './testFolders'

describe('createAndImportInitializedFolder', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-init-folder-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-init-folder-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaDir, { recursive: true, force: true })
  })

  it('skip-init imports then writes metadata that smm metadata can read', async () => {
    const created = await createAndImportInitializedFolder(mediaDir, musicFolder, {
      mediaMetadata: {
        type: 'music-folder',
        mediaFiles: [],
      },
    })

    expect(created.path).toBeDefined()
    const listed = await smm(['list'])
    expect(listed.code).toBe(0)
    expect(listed.stdout.split('\n').filter(Boolean)).toContain(created.path)

    const meta = await smm(['metadata', created.path!])
    expect(meta.code, meta.stderr || meta.stdout).toBe(0)
    expect(meta.stdout).toContain('type: music-folder')
  })
})
