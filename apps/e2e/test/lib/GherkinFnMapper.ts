/**
 * Maps Gherkin-style step strings to registered step functions.
 *
 * Pattern syntax: use `"xxx"` as a placeholder for a quoted-string parameter.
 * Example pattern: `TV show folder "xxx" was imported`
 * This matches step string: `TV show folder "UnKnown Folder 123" was imported`
 * and extracts `["UnKnown Folder 123"]` as args.
 */

export type StepFn = (context: Record<string, unknown>, args: string[]) => Promise<void>

interface StepEntry {
    pattern: string
    regex: RegExp
    fn: StepFn
}

export class GherkinFnMapper {
    private entries: StepEntry[] = []

    register(pattern: string, fn: StepFn): void {
        const regex = GherkinFnMapper.buildRegex(pattern)
        this.entries.push({ pattern, regex, fn })
    }

    resolve(stepString: string): { fn: StepFn; args: string[] } | undefined {
        for (const entry of this.entries) {
            const match = stepString.match(entry.regex)
            if (match) {
                return { fn: entry.fn, args: match.slice(1) }
            }
        }
        return undefined
    }

    async execute(context: Record<string, unknown>, stepString: string): Promise<boolean> {
        const resolved = this.resolve(stepString)
        if (!resolved) return false
        await resolved.fn(context, resolved.args)
        return true
    }

    private static buildRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const withCaptures = escaped.replace(/"xxx"/g, '"([^"]*)"')
        return new RegExp(`^${withCaptures}$`)
    }
}
