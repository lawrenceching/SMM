import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { handlePlans } from './Plans'

vi.mock('@/utils/buildAllowlist', () => ({
  buildAllowlist: async () => [],
}))

describe('POST /api/createPlan', () => {
  let userDataDir: string
  let appDataDir: string
  let previousUserDataDir: string | undefined
  let previousAppDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    previousUserDataDir = process.env.USER_DATA_DIR
    previousAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-plans-user-data-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-plans-app-data-'))
    process.env.USER_DATA_DIR = userDataDir
    process.env.APP_DATA_DIR = appDataDir
    app = new Hono()
    handlePlans(app)
  })

  afterEach(() => {
    if (previousUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = previousUserDataDir
    if (previousAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = previousAppDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(appDataDir, { recursive: true, force: true })
  })

  it('stores plans in the Core userDataDir when appDataDir differs', async () => {
    const id = '00000000-0000-4000-8000-000000000003'
    const response = await app.request('/api/createPlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        task: 'rename-files',
        mediaFolderPath: '/media/show',
        creator: 'app',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { plan: { id } } })
    expect(existsSync(join(userDataDir, 'plans', `${id}.plan.json`))).toBe(true)
    expect(existsSync(join(appDataDir, 'plans', `${id}.plan.json`))).toBe(false)
  })
})
