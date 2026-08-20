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
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    logs.push(parts.map(String).join(' '))
  })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    errors.push(parts.map(String).join(' '))
  })
  // Commander help writes via process.stdout.write, not console.log.
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    stdoutChunks += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
    return true
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
