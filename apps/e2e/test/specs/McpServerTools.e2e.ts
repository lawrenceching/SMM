import { expect } from '@wdio/globals'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const execFileAsync = promisify(execFile)

async function execMcpTestClient(
  clientCwd: string,
  env: NodeJS.ProcessEnv,
  toolName: string,
): Promise<{ stdout: string; stderr: string }> {
  // Use a login shell to pick up user PATH (bun is often installed via ~/.bun/bin).
  // This is more robust than trying to guess bun's absolute path in the WDIO runner env.
  return await execFileAsync(
    '/bin/bash',
    ['-lc', `cd "${clientCwd}" && bun index.ts --tool ${toolName}`],
    { env, timeout: 30_000 },
  )
}

describe('MCP Server Tools', () => {
  before(createBeforeHook())

  it('ReadmeTool should return README markdown', async function () {
    await StatusBar.clickMcpToggle()
    const isPopoverOpen = await StatusBar.waitForMcpPopover(5000)
    expect(isPopoverOpen).toBe(true)

    // Ensure MCP server is enabled and we have a runtime address to target.
    await StatusBar.clickMcpSwitch()
    // Give the server a moment to start.
    await delay(1000)

    const mcpAddress = await StatusBar.getMcpAddress()
    expect(mcpAddress).toContain('http://')

    const repoRoot = path.resolve(process.cwd(), '..', '..')
    const clientCwd = path.resolve(repoRoot, 'test/mcp-test-client')
    let lastErr: unknown
    let stdout = ''
    let stderr = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const env = {
          ...process.env,
          SMM_MCP_URL: mcpAddress,
        }

        const res = await execMcpTestClient(clientCwd, env, 'readme')

        stdout = res.stdout ?? ''
        stderr = res.stderr ?? ''
        lastErr = undefined
        break
      } catch (err) {
        lastErr = err
        // If the MCP server is still warming up, a short retry usually fixes it.
        await delay(1000)
      }
    }
    if (lastErr) throw lastErr

    // Keep stderr for debugging, but do not require it to be empty.
    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('Simple Media Manager (SMM)')
    expect(stdout).toContain('## 核心概念')

    // Turn off MCP server to avoid affecting other specs.
    await StatusBar.clickMcpSwitch()
  })
})
