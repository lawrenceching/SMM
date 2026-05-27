import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import {
  clearCommandExecutionRegistry,
  markCommandExecutionFinished,
  markCommandExecutionRunning,
} from './commandExecutionRegistry'
import { handleCommandExecutionStatus } from './commandExecutionStatus'

const EXEC_ID = '00000000-0000-4000-8000-000000000099'

describe('GET /api/command-execution/:executionId', () => {
  it('returns running from registry', async () => {
    clearCommandExecutionRegistry()
    markCommandExecutionRunning(EXEC_ID, 'yt-dlp')

    const app = new Hono()
    handleCommandExecutionStatus(app)
    const res = await app.request(`/api/command-execution/${EXEC_ID}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.phase).toBe('running')
    expect(body.found).toBe(true)
  })

  it('returns finished from registry', async () => {
    clearCommandExecutionRegistry()
    markCommandExecutionRunning(EXEC_ID, 'yt-dlp')
    markCommandExecutionFinished(EXEC_ID, {
      outcome: 'failure',
      exitCode: null,
      signal: 'SIGTERM',
      systemNote: 'client disconnected (abort)',
    })

    const app = new Hono()
    handleCommandExecutionStatus(app)
    const res = await app.request(`/api/command-execution/${EXEC_ID}`)
    const body = await res.json()
    expect(body.phase).toBe('finished')
    expect(body.outcome).toBe('failure')
  })

  it('rejects invalid id', async () => {
    const app = new Hono()
    handleCommandExecutionStatus(app)
    const res = await app.request('/api/command-execution/not-a-uuid')
    expect(res.status).toBe(400)
  })
})
