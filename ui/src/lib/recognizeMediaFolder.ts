import { tryToRecognizeMediaFolderByFolderName } from "./recognizeMediaFolderByFolderName";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";

export async function recognizeMediaFolder(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {

    console.log(`[recognizeMediaFolder] recognize media folder: ${folderPath}`)
    
    //1. try to recognize media folder by NFO
    try {
        const result = await tryToRecognizeMediaFolderByNFO(folderPath, signal)
        if(result.success) {
            console.log(`[recognizeMediaFolder] successfully recognized media folder by NFO: ${result.tmdbTvShow?.name} ${result.tmdbTvShow?.id}`)
            return result;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    //2.: try to recognize media folder by TMDB ID in folder name
    try {
        const mmRecognizedByTmdbIdInFolderName = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, signal)
        if(mmRecognizedByTmdbIdInFolderName.success) {
            console.log(`[recognizeMediaFolder] successfully recognized media folder by TMDB ID in folder name: ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.name} ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.id}`)
            return mmRecognizedByTmdbIdInFolderName;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
    }

    //3. try to recognize media folder by folder name
    try {
        const mmRecognizedByFolderName = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')
        if(mmRecognizedByFolderName.success) {
           console.log(`[recognizeMediaFolder] successfully recognized media folder by folder name: ${mmRecognizedByFolderName.tmdbTvShow?.name} ${mmRecognizedByFolderName.tmdbTvShow?.id}`)
           return mmRecognizedByFolderName;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`, error)
    }

    return {
        success: false,
    }
}
