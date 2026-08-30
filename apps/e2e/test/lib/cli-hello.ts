import { $ } from 'bun'
import type { HelloCliBody } from '@smm/core/types'

/**
 * Run `smm hello -f json` and parse {@link HelloCliBody}.
 *
 * CLI e2e only (`apps/e2e/cli`). Web UI / wdio e2e must use `GET /api/hello`
 * via `@smm/test` hello — do not import this module from wdio conf or `testbed.ts`.
 */
export async function runCliHello(binary: string): Promise<HelloCliBody> {
    const result = await $`${binary} hello -f json`.quiet().nothrow()
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    if (result.exitCode !== 0) {
        throw new Error(
            `"${binary} hello -f json" failed (exit ${result.exitCode}): ${stderr || stdout}`,
        )
    }

    try {
        return JSON.parse(stdout) as HelloCliBody
    } catch (error) {
        throw new Error(
            `Failed to parse "${binary} hello -f json" output as JSON: ${stdout}`,
            { cause: error },
        )
    }
}
