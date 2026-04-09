import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { PrimaryDatabase } from '@core/types'

export type UpdateMediaMetadataInPipeline = (
    path: string,
    metadata: UIMediaMetadata,
    options: { traceId: string }
) => void | Promise<void>

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

export async function runRecognitionSteps<T>(
    traceId: string,
    base: UIMediaMetadata,
    steps: RecognitionStep<T>[],
    applySuccess: (result: T) => UIMediaMetadata,
    updateMediaMetadata: UpdateMediaMetadataInPipeline
): Promise<boolean> {
    const path = base.mediaFolderPath!
    for (const step of steps) {
        const result = await step.tryRecognize()
        if (result !== undefined) {
            console.log(`[${traceId}] HIT: ${step.logLabel}`)
            await Promise.resolve(updateMediaMetadata(path, applySuccess(result), { traceId }))
            return true
        }
        console.log(`[${traceId}] MISS: ${step.logLabel}`)
    }
    return false
}
