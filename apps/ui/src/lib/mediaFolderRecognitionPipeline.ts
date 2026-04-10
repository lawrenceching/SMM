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
    for (const step of steps) {
        const result = await step.tryRecognize()
        if (result !== undefined) {
            console.log(`[${traceId}] HIT: ${step.logLabel}`)
            return result
        }
        console.log(`[${traceId}] MISS: ${step.logLabel}`)
    }
    return undefined
}
