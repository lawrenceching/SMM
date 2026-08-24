import { $ } from 'bun'
import type { HelloCliBody } from '@smm/core/types'

/**
 * Run `smm hello -f json` and parse {@link HelloCliBody}.
 * Used by CLI e2e setup/cleanup instead of `GET /api/hello`.
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
