import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import type { Server } from 'node:net'
import {
  classifyPortOccupant,
  findFreePortWithSniff,
  formatPortOccupantProbe,
  formatPortSniffOutcome,
  logPortSniffPass,
  portStartupLogPath,
  type ListenProbeFactory,
} from './portStartupDiag'

describe('classifyPortOccupant', () => {
  it('classifies connection refused as free', () => {
    expect(
      classifyPortOccupant({
        status: null,
        contentType: null,
        bodySnippet: null,
        error: 'fetch failed: Error: connect ECONNREFUSED 127.0.0.1:30021',
      }),
    ).toBe('free')
  })

  it('classifies MCP streamable HTTP 406 as mcp', () => {
    expect(
      classifyPortOccupant({
        status: 406,
        contentType: 'application/json',
        bodySnippet:
          '{"jsonrpc":"2.0","error":{"message":"Not Acceptable: Client must accept text/event-stream"}}',
        error: null,
      }),
    ).toBe('mcp')
  })

  it('classifies HTML 200 as html', () => {
    expect(
      classifyPortOccupant({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        bodySnippet: '<!DOCTYPE html>',
        error: null,
      }),
    ).toBe('html')
  })
})

describe('formatPortOccupantProbe', () => {
  it('formats free ports briefly', () => {
    expect(
      formatPortOccupantProbe(30021, {
        kind: 'free',
        status: null,
        contentType: null,
        bodySnippet: null,
        error: null,
      }),
    ).toBe('port=30021 occupant=free')
  })
})

describe('portStartupLogPath', () => {
  it('uses tmpdir basename', () => {
    expect(portStartupLogPath('/tmp').replace(/\\/g, '/')).toBe('/tmp/smm-port-startup.log')
  })
})

describe('formatPortSniffOutcome', () => {
  it('formats excluded / busy / free', () => {
    expect(formatPortSniffOutcome({ port: 30001, outcome: 'excluded', reason: 'exclude-set' })).toBe(
      'port=30001 sniff=excluded reason=exclude-set',
    )
    expect(formatPortSniffOutcome({ port: 30000, outcome: 'busy', code: 'EADDRINUSE' })).toBe(
      'port=30000 sniff=busy code=EADDRINUSE',
    )
    expect(formatPortSniffOutcome({ port: 30002, outcome: 'free' })).toBe('port=30002 sniff=free')
  })
})

function mockListenServer(behavior: 'busy' | 'free'): Server {
  const server = new EventEmitter() as Server
  // Avoid `void Promise` — esbuild misparses it inside this casted assignment.
  const schedule = (fn: () => void): void => {
    setTimeout(fn, 0)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(server as any).listen = (_port: number, _host: string, cb?: () => void) => {
    schedule(() => {
      if (behavior === 'busy') {
        const err = new Error('busy') as NodeJS.ErrnoException
        err.code = 'EADDRINUSE'
        server.emit('error', err)
        return
      }
      cb?.()
    })
    return server
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(server as any).close = () => {
    schedule(() => server.emit('close'))
    return server
  }
  return server
}

describe('findFreePortWithSniff', () => {
  it('records exclude then busy then free', async () => {
    let listenCalls = 0
    const factory: ListenProbeFactory = () => {
      listenCalls += 1
      return mockListenServer(listenCalls === 1 ? 'busy' : 'free')
    }

    const { port, sniffs } = await findFreePortWithSniff(
      30000,
      30010,
      new Set([30001]),
      factory,
    )
    expect(port).toBe(30002)
    expect(sniffs).toEqual([
      { port: 30000, outcome: 'busy', code: 'EADDRINUSE' },
      { port: 30001, outcome: 'excluded', reason: 'exclude-set' },
      { port: 30002, outcome: 'free' },
    ])
  })
})

describe('logPortSniffPass', () => {
  it('emits begin/step/end lines for each sniff', () => {
    const lines: string[] = []
    const prev = console.error
    console.error = ((msg: string) => {
      lines.push(String(msg))
    }) as typeof console.error
    try {
      logPortSniffPass({
        purpose: 'ui',
        minPort: 30000,
        maxPort: 65535,
        exclude: new Set([30001]),
        sniffs: [
          { port: 30000, outcome: 'busy', code: 'EADDRINUSE' },
          { port: 30001, outcome: 'excluded', reason: 'exclude-set' },
          { port: 30002, outcome: 'free' },
        ],
        selected: 30002,
        describeBusyListeners: () => 'COMMAND pid',
      })
    } finally {
      console.error = prev
    }
    const joined = lines.join('\n')
    expect(joined).toContain('sniff-begin purpose=ui')
    expect(joined).toContain('exclude=[30001]')
    expect(joined).toContain(
      'sniff-step purpose=ui port=30000 sniff=busy code=EADDRINUSE lsof=COMMAND pid',
    )
    expect(joined).toContain('sniff-step purpose=ui port=30001 sniff=excluded')
    expect(joined).toContain('sniff-step purpose=ui port=30002 sniff=free')
    expect(joined).toContain(
      'sniff-end purpose=ui selected=30002 tried=3 busy=[30000] excluded=[30001]',
    )
  })
})
