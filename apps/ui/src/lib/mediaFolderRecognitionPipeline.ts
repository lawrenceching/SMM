import type { PrimaryDatabase } from '@core/types'

export interface RecognitionStep<T> {
    logLabel: string
    tryRecognize: () => Promise<T | undefined>
}

/** TMDB first when primary is default or TMDB; TVDB first when primary is TVDB. */
export function searchOrderForPrimaryDb(
    primaryDatabase: PrimaryDatabase | undefined
): Array<'TMDB' | 'TVDB'> {
    return primaryDatabase === 'TVDB' ? ['TVDB', 'TMDB'] : ['TMDB', 'TVDB']
}

/** Runs steps in order; returns the first defined result, or undefined if all miss. */
export async function runRecognitionSteps<T>(
    traceId: string,
    steps: RecognitionStep<T>[]
): Promise<T | undefined> {
    const startedAt = performance.now()
    console.log(`[${traceId}] runRecognitionSteps start: ${steps.length} steps`)
    for (const step of steps) {
        const result = await step.tryRecognize()
        if (result !== undefined) {
            console.log(`[${traceId}] HIT: ${step.logLabel}`)
            const durationMs = Math.round(performance.now() - startedAt)
            console.log(`[${traceId}] runRecognitionSteps done in ${durationMs}ms, hit=true`)
            return result
        }
        console.log(`[${traceId}] MISS: ${step.logLabel}`)
    }
    const durationMs = Math.round(performance.now() - startedAt)
    console.log(`[${traceId}] runRecognitionSteps done in ${durationMs}ms, hit=false`)
    return undefined
}
