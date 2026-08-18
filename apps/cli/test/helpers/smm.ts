import { vi } from 'vitest'
import { resetCoreForTests } from '../../src/core/getCore'
import { runCli } from '../../src/cli/runCli'

export interface SmmResult {
  code: number
  stdout: string
  stderr: string
}

/** Run one `smm` command in-process and capture console output. */
export async function smm(args: string[]): Promise<SmmResult> {
  const logs: string[] = []
  const errors: string[] = []
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    logs.push(parts.map(String).join(' '))
  })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    errors.push(parts.map(String).join(' '))
  })
  try {
    const code = await runCli(['node', 'smm', ...args])
    return { code, stdout: logs.join('\n'), stderr: errors.join('\n') }
  } finally {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  }
}

export { resetCoreForTests }
