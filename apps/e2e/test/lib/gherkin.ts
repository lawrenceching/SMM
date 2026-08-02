/**
 * Lightweight Gherkin-style step helpers for e2e tests.
 *
 * Supports two modes:
 * 1. **Registered steps:** call `registerStep(pattern, fn)`, then use
 *    `given('TV show folder "xxx" was imported')` without a fallback function.
 *    The mapper resolves the string to the registered function and calls it
 *    with the shared context and extracted args.
 * 2. **Inline steps:** pass a fallback function directly:
 *    `given('some label', async () => { ... })`
 * 3. **Object payload (given/when/then):** pass a plain object as the second arg;
 *    it is stored on the shared context (`_stepArg` for `given`/`then`,
 *    `_importFolderDef` for `when`) for the registered step to read.
 *
 * Usage in a Mocha `it` block:
 *
 *   import { given, when, then, resetStepContext } from '../../lib/gherkin'
 *   import '../steps'  // triggers step registration
 *
 *   it('my scenario', async () => {
 *     resetStepContext()
 *     await given('TV show folder "..." was imported')
 *     await when('folder "..." was selected')
 *     await then('"Rename" button is disabled', async () => { ... })
 *   })
 */

import { GherkinFnMapper } from './GherkinFnMapper'
import type { StepFn } from './GherkinFnMapper'

const mapper = new GherkinFnMapper()
let currentContext: Record<string, unknown> = {}

export function resetStepContext(): void {
    currentContext = {}
}

export function getStepContext(): Record<string, unknown> {
    return currentContext
}

/** Gherkin capture groups are typed as optional; fail fast when a required arg is missing. */
export function requiredStepArg(args: string[], index = 0): string {
    const value = args[index]
    if (value === undefined) {
        throw new Error(`Missing Gherkin step argument at index ${index}`)
    }
    return value
}

export function registerStep(pattern: string, fn: StepFn): void {
    mapper.register(pattern, fn)
}

async function executeStep(
    prefix: string,
    stepString: string,
    fallbackFn?: () => Promise<void>,
): Promise<void> {
    console.log(`  ${prefix} ${stepString}`)
    const resolved = mapper.resolve(stepString)
    if (resolved) {
        await resolved.fn(currentContext, resolved.args)
        return
    }
    if (fallbackFn) {
        await fallbackFn()
        return
    }
    console.warn(`  [gherkin] No step registered for: "${stepString}"`)
}

export async function given(
    label: string,
    arg?: (() => Promise<void>) | Record<string, unknown>,
): Promise<void> {
    if (arg !== undefined && typeof arg !== 'function') {
        currentContext._stepArg = arg
        await executeStep('Given', label, undefined)
        return
    }
    await executeStep('Given', label, arg as (() => Promise<void>) | undefined)
}

export async function when(
    label: string,
    arg?: (() => Promise<void>) | Record<string, unknown>,
): Promise<void> {
    if (arg !== undefined && typeof arg !== 'function') {
        currentContext._importFolderDef = arg
        await executeStep('When', label, undefined)
        return
    }
    await executeStep('When', label, arg as (() => Promise<void>) | undefined)
}

export async function then(
    label: string,
    arg?: (() => Promise<void>) | Record<string, unknown>,
): Promise<void> {
    if (arg !== undefined && typeof arg !== 'function') {
        currentContext._stepArg = arg
        await executeStep('Then', label, undefined)
        return
    }
    await executeStep('Then', label, arg as (() => Promise<void>) | undefined)
}

export async function and(label: string, fn?: () => Promise<void>): Promise<void> {
    await executeStep('And', label, fn)
}
