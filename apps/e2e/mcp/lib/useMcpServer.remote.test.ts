import { afterEach, describe, expect, it, vi } from 'vitest'
import { startMcpServer } from './mcpServer'
import { createMcpTestContext } from './useMcpServer'

vi.mock('./mcpServer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mcpServer')>()
  return {
    ...actual,
    startMcpServer: vi.fn(async () => {
      throw new Error('startMcpServer must not be called for remote')
    }),
  }
})

function stubHelloFetch(dirs: { userDataDir: string; appDataDir: string }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(dirs),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('createMcpTestContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.mocked(startMcpServer).mockReset()
    vi.mocked(startMcpServer).mockImplementation(async () => {
      throw new Error('startMcpServer must not be called for remote')
    })
  })

  it('does not spawn local MCP when TARGET=remote', async () => {
    vi.stubEnv('TARGET', 'remote')
    vi.stubEnv('MCP_SERVER_ADDRESS', 'http://127.0.0.1:30001/mcp')
    vi.stubEnv('HTTP_SERVER_ADDRESS', 'http://127.0.0.1:30000')
    vi.stubEnv('SMM_AUTH_TOKEN', 'tok')
    vi.stubEnv('SMM_DOCKER_CONTAINER', 'my-smm')
    stubHelloFetch({ userDataDir: '/data/user', appDataDir: '/data/app' })

    const ctx = await createMcpTestContext()

    expect(startMcpServer).not.toHaveBeenCalled()
    expect(ctx.url).toBe('http://127.0.0.1:30001/mcp')
    expect(ctx.isRemote).toBe(true)
    expect(ctx.userDataDir).toBe('/data/user')
    expect(ctx.appDataDir).toBe('/data/app')
    expect(ctx.httpServerAddress).toBe('http://127.0.0.1:30000')
    expect(ctx.authToken).toBe('tok')
    expect(ctx.containerName).toBe('my-smm')
    expect(ctx.server).toBeUndefined()
    await expect(ctx.stop()).resolves.toBeUndefined()
  })

  it('spawns local MCP when TARGET is not remote', async () => {
    vi.stubEnv('TARGET', 'dev')
    const stop = vi.fn(async () => {})
    vi.mocked(startMcpServer).mockResolvedValue({
      url: 'http://127.0.0.1:9/mcp',
      userDataDir: '/tmp/user',
      appDataDir: '/tmp/app',
      stop,
    })

    const ctx = await createMcpTestContext()

    expect(startMcpServer).toHaveBeenCalledTimes(1)
    expect(ctx.isRemote).toBe(false)
    expect(ctx.url).toBe('http://127.0.0.1:9/mcp')
    expect(ctx.userDataDir).toBe('/tmp/user')
    expect(ctx.appDataDir).toBe('/tmp/app')
    expect(ctx.server).toBeDefined()
    await ctx.stop()
    expect(stop).toHaveBeenCalledTimes(1)
  })
})
