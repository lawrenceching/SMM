import { $ } from 'bun'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the MCP Inspector CLI launcher installed by
 * `@modelcontextprotocol/inspector` (root devDependency). Invoke with
 * `node` directly — `npx` mangles backslash paths and JSON args on Windows.
 */
function resolveInspectorLauncher(): string {
  const pkgUrl = import.meta.resolve('@modelcontextprotocol/inspector/package.json')
  const pkgPath = fileURLToPath(pkgUrl)
  return join(dirname(pkgPath), 'clients', 'launcher', 'build', 'index.js')
}

/** List the MCP server's tools via `tools/list`. */
export async function listTools(mcpUrl: string): Promise<string[]> {
  const launcher = resolveInspectorLauncher()
  const argv = [
    launcher,
    '--cli',
    '--server-url',
    mcpUrl,
    '--method',
    'tools/list',
    '--format',
    'json',
  ]
  const res = await $`node ${argv}`.quiet().nothrow()
  let parsed: { result?: { tools?: Array<{ name: string }> } } | null = null
  try {
    parsed = JSON.parse(res.stdout.toString().trim())
  } catch {
    parsed = null
  }
  return (parsed?.result?.tools ?? []).map((t) => t.name)
}
