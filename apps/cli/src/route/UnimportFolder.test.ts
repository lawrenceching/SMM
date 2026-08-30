import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleUnimportFolder } from './UnimportFolder'
import { metadataCachePath } from '../../test/helpers/testFolders'
import { installCliTestEnv, restoreCliTestEnv, type CliTestEnv } from '../../test/helpers/cliTestEnv'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/unimport-folder', () => {
  let env: CliTestEnv
  let app: Hono

  beforeEach(() => {
    env = installCliTestEnv('smm-unimport-folder')
    app = new Hono()
    handleUnimportFolder(app)
  })

  afterEach(() => {
    restoreCliTestEnv(env)
  })

  async function post(body: unknown) {
    return app.request('/api/unimport-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('removes the folder from smm.json and deletes metadata cache', async () => {
    writeFileSync(
      join(env.userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/A', '/media/B'] }),
      'utf-8',
    )
    mkdirSync(join(env.appDataDir, 'metadata'), { recursive: true })
    const cacheFile = metadataCachePath(env.appDataDir, '/media/A')
    writeFileSync(cacheFile, JSON.stringify({ mediaFolderPath: '/media/A' }), 'utf-8')
    resetCoreForTests()

    const res = await post({ path: '/media/A' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { path: '/media/A' } })

    const saved = JSON.parse(readFileSync(join(env.userDataDir, 'smm.json'), 'utf-8')) as { folders: string[] }
    expect(saved.folders).toEqual(['/media/B'])
    expect(existsSync(cacheFile)).toBe(false)
  })

  it('succeeds when the folder is not imported', async () => {
    writeFileSync(
      join(env.userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/Keep'] }),
      'utf-8',
    )
    resetCoreForTests()

    const res = await post({ path: '/media/Missing' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { path: '/media/Missing' } })

    const saved = JSON.parse(readFileSync(join(env.userDataDir, 'smm.json'), 'utf-8')) as { folders: string[] }
    expect(saved.folders).toEqual(['/media/Keep'])
  })

  it('returns Error Reason when path is missing', async () => {
    const res = await post({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })
})
