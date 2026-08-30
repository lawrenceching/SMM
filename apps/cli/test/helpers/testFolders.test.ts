import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { smm } from './smm'
import { createAndImportInitializedFolder, musicFolder } from './testFolders'
import { installCliTestEnv, restoreCliTestEnv, type CliTestEnv } from './cliTestEnv'

describe('createAndImportInitializedFolder', () => {
  let env: CliTestEnv
  let mediaDir: string

  beforeEach(() => {
    env = installCliTestEnv('smm-init-folder')
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-init-folder-media-'))
  })

  afterEach(() => {
    rmSync(mediaDir, { recursive: true, force: true })
    restoreCliTestEnv(env)
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
