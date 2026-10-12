/**
 * Ensure a remote SMM instance has its MCP server running via HTTP API
 * (GET /api/get-mcp-server-status, POST /api/start-mcp-server).
 * See docs/dev/mcp.md — Turn on/off MCP server.
 */

export interface McpServerState {
    status: 'running' | 'stopped' | 'error'
    host?: string
    port?: number
    url?: string
    error?: string
}

interface McpServerStateResponse {
    data?: McpServerState
    error?: string | null
}

export interface EnsureRemoteMcpOptions {
    httpServerAddress: string
    authToken: string
    /** Optional listen port for POST /api/start-mcp-server. */
    mcpPort?: number
}

function authHeaders(authToken: string, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra }
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
    }
    return headers
}

async function parseMcpResponse(resp: Response): Promise<McpServerState> {
    if (!resp.ok) {
        throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
    }
    const body = (await resp.json()) as McpServerStateResponse
    if (body.error) {
        throw new Error(body.error)
    }
    if (!body.data) {
        throw new Error('Error Reason: MCP server response missing data')
    }
    if (body.data.status === 'error') {
        throw new Error(body.data.error ?? 'Error Reason: MCP server error')
    }
    return body.data
}

export async function getMcpServerStatus(
    httpServerAddress: string,
    authToken: string,
): Promise<McpServerState> {
    const url = `${httpServerAddress.replace(/\/$/, '')}/api/get-mcp-server-status`
    const resp = await fetch(url, {
        method: 'GET',
        headers: authHeaders(authToken),
        signal: AbortSignal.timeout(10_000),
    })
    return parseMcpResponse(resp)
}

export async function startMcpServer(
    httpServerAddress: string,
    authToken: string,
    options?: { port?: number },
): Promise<McpServerState> {
    const url = `${httpServerAddress.replace(/\/$/, '')}/api/start-mcp-server`
    const body: { port?: number } = {}
    if (options?.port !== undefined) {
        body.port = options.port
    }
    const resp = await fetch(url, {
        method: 'POST',
        headers: authHeaders(authToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
    })
    return parseMcpResponse(resp)
}

/**
 * If remote MCP is not running, start it via HTTP API.
 */
export async function ensureRemoteMcpServerRunning(
    options: EnsureRemoteMcpOptions,
): Promise<McpServerState> {
    const status = await getMcpServerStatus(options.httpServerAddress, options.authToken)
    if (status.status === 'running') {
        return status
    }
    return startMcpServer(options.httpServerAddress, options.authToken, {
        port: options.mcpPort,
    })
}

/** Parse listen port from an MCP client URL such as `http://127.0.0.1:30001/mcp`. */
export function parseMcpPortFromAddress(mcpServerAddress: string): number | undefined {
    try {
        const url = new URL(mcpServerAddress)
        if (!url.port) return undefined
        const port = Number(url.port)
        return Number.isFinite(port) ? port : undefined
    } catch {
        return undefined
    }
}
