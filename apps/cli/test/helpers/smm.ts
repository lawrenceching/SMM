import { vi } from 'vitest'
import { resetCoreForTests } from '../../src/core/getCore'
import { runCli } from '../../src/cli/runCli'

export interface SmmResult {
  code: number
  stdout: string
  stderr: string
}

/** Run one `smm` command in-process and capture console / stdout output. */
export async function smm(args: string[]): Promise<SmmResult> {
  const logs: string[] = []
  const errors: string[] = []
  let stdoutChunks = ''
  // Capture for assertions, but still mirror to the real console so hangs/timeouts stay visible.
  const originalLog = console.log.bind(console)
  const originalError = console.error.bind(console)
  const originalWrite = process.stdout.write.bind(process.stdout)
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    logs.push(parts.map(String).join(' '))
    originalLog(...parts)
  })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    errors.push(parts.map(String).join(' '))
    originalError(...parts)
  })
  // Commander help writes via process.stdout.write, not console.log.
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    stdoutChunks += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
    return (originalWrite as (...args: unknown[]) => boolean)(chunk, ...rest)
  }) as typeof process.stdout.write)
  try {
    const code = await runCli(['node', 'smm', ...args])
    const consoleOut = logs.join('\n')
    const stdout = stdoutChunks ? `${stdoutChunks}${consoleOut}` : consoleOut
    return { code, stdout, stderr: errors.join('\n') }
  } finally {
    writeSpy.mockRestore()
    logSpy.mockRestore()
    errorSpy.mockRestore()
  }
}

export { resetCoreForTests }
