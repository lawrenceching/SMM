/**
 * The utility of running MCP e2e tests.
 *
 * Usage:
 *   bun entrypoint.ts --target <target> --http <http-server-address> --mcp-server <mcp-server-address>
 *
 * Env (CLI overrides env):
 *   TARGET, HTTP_SERVER_ADDRESS, MCP_SERVER_ADDRESS, SMM_AUTH_TOKEN
 */
import { $ } from 'bun'
import { CommanderError } from 'commander'
import { waitFor } from '@smm/utils/waitFor'
import { type Context, parseContext } from './lib/context'
import {
    ensureRemoteMcpServerRunning,
    parseMcpPortFromAddress,
} from './lib/remoteMcp'

export type { Context, Target } from './lib/context'
export { parseContext } from './lib/context'

async function waitForHttpHello(ctx: Context): Promise<void> {
    await waitFor(
        async () => {
            const address = ctx.httpServerAddress
            if (!address) {
                throw new Error(
                    'httpServerAddress is required (pass --http or HTTP_SERVER_ADDRESS)',
                )
            }
            const url = `${address.replace(/\/$/, '')}/api/hello`
            const headers: Record<string, string> = {}
            if (ctx.authToken) {
                headers.Authorization = `Bearer ${ctx.authToken}`
            }
            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(3_000),
            })
            if (response.status !== 200) {
                throw new Error(`HTTP server not ready at ${url}: HTTP ${response.status}`)
            }
        },
        { timeout: 30_000, interval: 500 },
    )
}

async function waitForMcpReady(ctx: Context): Promise<void> {
    await waitFor(
        async () => {
            const address = ctx.mcpServerAddress
            if (!address) {
                throw new Error(
                    'mcpServerAddress is required (pass --mcp-server or MCP_SERVER_ADDRESS)',
                )
            }
            const response = await fetch(address, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: { name: 'mcp-e2e', version: '0.0.0' },
                    },
                }),
                signal: AbortSignal.timeout(3_000),
            })
            if (!response.ok) {
                throw new Error(
                    `MCP server not ready at ${address}: HTTP ${response.status}`,
                )
            }
        },
        { timeout: 30_000, interval: 500 },
    )
}

export async function run(ctx: Context): Promise<void> {
    // Vitest MCP tool tests spawn apps/cli/dist via useMcpServer — rebuild first
    // so source fixes (e.g. core-routes) are not left behind a stale binary.
    await $`pnpm --filter cli build`

    if (ctx.target === 'dev') {
        // Start the dev MCP server
        $`pnpm --filter cli mcp`
    } else if (ctx.target === 'cli') {
        $`${ctx.projectRoot}/apps/cli/dist/cli.exe mcp start`
    }

    if (ctx.target === 'remote') {
        // HTTP must be up before MCP lifecycle RPCs.
        await waitForHttpHello(ctx)
        // 1. Check MCP server status via HTTP API
        // 2. If stopped, turn it on via POST /api/start-mcp-server
        await ensureRemoteMcpServerRunning({
            httpServerAddress: ctx.httpServerAddress,
            authToken: ctx.authToken,
            mcpPort: parseMcpPortFromAddress(ctx.mcpServerAddress),
        })
    }

    await waitForMcpReady(ctx)

    await $`pnpm --filter e2e vitest:mcp`
}

async function main(): Promise<void> {
    const ctx = parseContext()
    await run(ctx)
}

if (import.meta.main) {
    main().catch((error: unknown) => {
        if (error instanceof CommanderError) {
            process.exit(error.exitCode)
        }
        console.error(error)
        process.exit(1)
    })
}
