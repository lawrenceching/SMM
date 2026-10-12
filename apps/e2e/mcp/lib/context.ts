/**
 * CLI/env parsing for MCP e2e entrypoint.
 *
 * Priority: CLI options > environment variables > defaults (`target=dev`).
 * When `target=remote`, HTTP address, MCP address, and SMM_AUTH_TOKEN are required.
 */
import { Command, Option } from 'commander'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRoot } from './mcpServer'

const TARGETS = ['dev', 'cli', 'remote'] as const

export type Target = (typeof TARGETS)[number]

export interface Context {
    target: Target
    httpServerAddress: string
    mcpServerAddress: string
    /** Bearer token for HTTP API auth (env: SMM_AUTH_TOKEN). */
    authToken: string
    projectRoot: string
}

function loadEnv(): void {
    const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    dotenv.config({ path: path.join(e2eRoot, '.env'), quiet: true })
    dotenv.config({ path: path.join(e2eRoot, '.env.local'), quiet: true })
}

function isTarget(value: string): value is Target {
    return (TARGETS as readonly string[]).includes(value)
}

/**
 * Parse CLI args and env into a {@link Context}.
 * Priority: CLI options > environment variables > defaults (`target=dev`).
 * When `target=remote`, HTTP address, MCP address, and SMM_AUTH_TOKEN are required.
 */
export function parseContext(argv: string[] = process.argv): Context {
    loadEnv()

    const program = new Command()
    program
        .exitOverride()
        .name('mcp-e2e')
        .description('Run MCP e2e tests')
        .addOption(
            new Option('--target <target>', 'Test target: dev | cli | remote')
                .choices([...TARGETS])
                .default(process.env.TARGET?.trim() || 'dev'),
        )
        .option(
            '--http <address>',
            'HTTP server address (env: HTTP_SERVER_ADDRESS)',
            process.env.HTTP_SERVER_ADDRESS,
        )
        .option(
            '--mcp-server <address>',
            'MCP server address (env: MCP_SERVER_ADDRESS)',
            process.env.MCP_SERVER_ADDRESS,
        )
        .allowExcessArguments(false)
        .helpOption('-h, --help')

    program.parse(argv)
    const opts = program.opts<{
        target: string
        http?: string
        mcpServer?: string
    }>()

    if (!isTarget(opts.target)) {
        program.error(
            `Invalid target "${opts.target}". Expected one of: ${TARGETS.join(', ')}`,
        )
    }

    const httpServerAddress = opts.http?.trim() ?? ''
    const mcpServerAddress = opts.mcpServer?.trim() ?? ''
    const authToken = process.env.SMM_AUTH_TOKEN?.trim() ?? ''

    if (opts.target === 'remote') {
        const missing: string[] = []
        if (!httpServerAddress) missing.push('--http / HTTP_SERVER_ADDRESS')
        if (!mcpServerAddress) missing.push('--mcp-server / MCP_SERVER_ADDRESS')
        if (!authToken) missing.push('SMM_AUTH_TOKEN')
        if (missing.length > 0) {
            program.error(`target=remote requires: ${missing.join(', ')}`)
        }
    }

    return {
        target: opts.target,
        httpServerAddress,
        mcpServerAddress,
        authToken,
        projectRoot: repoRoot(),
    }
}
