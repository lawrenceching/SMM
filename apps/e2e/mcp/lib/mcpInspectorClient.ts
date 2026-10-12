import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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
  let stdout = ''
  try {
    const res = await execFileAsync('node', argv, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
    stdout = res.stdout
  } catch {
    stdout = ''
  }
  let parsed: { result?: { tools?: Array<{ name: string }> } } | null = null
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    parsed = null
  }
  return (parsed?.result?.tools ?? []).map((t) => t.name)
}

export interface McpCallResult {
  /** `result.structuredContent` from the MCP tool response. */
  structuredContent: Record<string, unknown> | null
  /** Whether the tool response had `isError: true`. */
  isError: boolean
  /** Raw tool response text content (unparsed). */
  textContent: string | null
  /** Raw stdout from the inspector CLI. */
  stdout: string
  /** Inspector CLI exit code. */
  exitCode: number
}

/**
 * Call an MCP tool through the MCP Inspector CLI (`--cli --method tools/call`).
 *
 * @param mcpUrl MCP server URL, e.g. `http://127.0.0.1:30001/mcp`.
 * @param toolName Kebab-case tool name.
 * @param args Optional tool arguments (passed via `--tool-args-json`).
 */
export async function callTool(
  mcpUrl: string,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<McpCallResult> {
  const launcher = resolveInspectorLauncher()
  const argv = [
    launcher,
    '--cli',
    '--server-url',
    mcpUrl,
    '--method',
    'tools/call',
    '--tool-name',
    toolName,
    '--format',
    'json',
  ]
  if (args !== undefined) {
    argv.push('--tool-args-json', JSON.stringify(args))
  }

  let stdout = ''
  let exitCode = 0
  try {
    const res = await execFileAsync('node', argv, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
    stdout = res.stdout
    exitCode = 0
  } catch (err: unknown) {
    const e = err as { stdout?: string; code?: number }
    stdout = e.stdout ?? ''
    exitCode = typeof e.code === 'number' ? e.code : 1
  }

  let parsed: {
    result?: {
      content?: Array<{ type: string; text?: string }>
      structuredContent?: Record<string, unknown>
      isError?: boolean
    }
  } | null = null
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    parsed = null
  }

  const result = parsed?.result
  const textContent =
    result?.content?.find((c) => c.type === 'text' && typeof c.text === 'string')?.text ??
    null

  // Inspector can exit non-zero with empty / unparseable stdout (e.g. Windows
  // libuv assertion on tool-error paths). Treat that as an error so callers
  // can retry rather than silently getting `isError: false`.
  const failedToParse =
    parsed === null && (exitCode !== 0 || stdout.length === 0)

  return {
    structuredContent: result?.structuredContent ?? null,
    isError: (result?.isError ?? false) || failedToParse,
    textContent,
    stdout,
    exitCode,
  }
}
