import { describe, expect, it } from 'vitest'
import type { CoreRoutesLogger } from '@smm/core-routes'
import { createApp } from './app'

const noopLogger: CoreRoutesLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const enabledAuth = { enabled: true, token: 'secret' }

describe('createApp middleware composition', () => {
  it('returns 401 for /api requests without Authorization when auth is enabled', async () => {
    const app = createApp({ auth: enabledAuth, logger: noopLogger })
    const res = await app.request('/api/get-folders', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized: invalid or missing token' })
  })

  it('lets requests with a valid bearer token reach the handler', async () => {
    const app = createApp({ auth: enabledAuth, logger: noopLogger })
    app.post('/api/auth-probe', (c) => c.text('ok'))
    const res = await app.request('/api/auth-probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('answers CORS preflight OPTIONS without auth', async () => {
    const app = createApp({ auth: enabledAuth, logger: noopLogger })
    const res = await app.request('/api/get-folders', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
  })

  it('exempts /api/log from auth', async () => {
    const app = createApp({ auth: enabledAuth, logger: noopLogger })
    app.post('/api/log', (c) => c.text('logged'))
    const res = await app.request('/api/log', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('logged')
  })

  it('defaults API responses to Cache-Control: no-store', async () => {
    const app = createApp({ logger: noopLogger })
    app.get('/api/thing', (c) => c.text('ok'))
    const res = await app.request('/api/thing')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('keeps explicit caching headers on API responses', async () => {
    const app = createApp({ logger: noopLogger })
    app.get('/api/image', (c) => {
      c.header('Cache-Control', 'public, max-age=3600')
      return c.text('ok')
    })
    const res = await app.request('/api/image')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  it('lets /api requests pass without Authorization when auth is disabled', async () => {
    const app = createApp({ logger: noopLogger })
    app.get('/api/get-folders', (c) => c.text('ok'))
    const res = await app.request('/api/get-folders')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
