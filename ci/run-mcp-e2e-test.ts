/**
 * MCP tools e2e runner: `bun test` under `apps/e2e/mcp` against
 * `apps/cli/dist/cli` (built binary + `smm mcp start` + MCP Inspector).
 *
 * Usage (from repo root):
 *   bun ci/run-mcp-e2e-test.ts
 *   bun ci/run-mcp-e2e-test.ts ./mcp/tools-list.test.ts
 */
import { $ } from 'bun'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '..')
const E2E_DIR = path.join(ROOT, 'apps/e2e')
const CLI_BIN = path.join(
  ROOT,
  'apps/cli/dist',
  process.platform === 'win32' ? 'cli.exe' : 'cli',
)

function ensureCliBinary(): void {
  if (!fs.existsSync(CLI_BIN)) {
    console.error(`CLI binary not found: ${CLI_BIN}`)
    console.error('Run: pnpm --filter cli run build')
    process.exit(1)
  }

  // GitHub Actions download-artifact does not preserve the executable bit.
  if (process.platform !== 'win32') {
    fs.chmodSync(CLI_BIN, 0o755)
  }
}

async function main(): Promise<number> {
  ensureCliBinary()

  const extraArgs = process.argv.slice(2)
  const testArgs = extraArgs.length > 0 ? extraArgs : ['./mcp/']

  const result = await $`bun test ${testArgs}`.cwd(E2E_DIR).env(process.env).nothrow()
  return result.exitCode
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('failed:', error)
    process.exit(1)
  })
