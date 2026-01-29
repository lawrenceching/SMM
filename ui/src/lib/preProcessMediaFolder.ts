import { tryToRecognizeMediaFolderByFolderName } from "./recognizeMediaFolderByFolderName";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";

export async function preprocessMediaFolder(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {

    console.log(`[preprocessMediaFolder] preprocess media folder: ${folderPath}`)
    
    //1. try to recognize media folder by NFO
    try {
        const mmRecognizedByNFO = await tryToRecognizeMediaFolderByNFO(folderPath, signal)
        if(mmRecognizedByNFO.success) {
            console.log(`[preprocessMediaFolder] successfully recognized media folder by NFO: ${mmRecognizedByNFO.tmdbTvShow?.name} ${mmRecognizedByNFO.tmdbTvShow?.id}`)
            return mmRecognizedByNFO;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    //2.: try to recognize media folder by TMDB ID in folder name
    try {
        const mmRecognizedByTmdbIdInFolderName = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, signal)
        if(mmRecognizedByTmdbIdInFolderName.success) {
            console.log(`[preprocessMediaFolder] successfully recognized media folder by TMDB ID in folder name: ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.name} ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.id}`)
            return mmRecognizedByTmdbIdInFolderName;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
    }

    //3. try to recognize media folder by folder name
    try {
        const mmRecognizedByFolderName = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')
        if(mmRecognizedByFolderName.success) {
           console.log(`[preprocessMediaFolder] successfully recognized media folder by folder name: ${mmRecognizedByFolderName.tmdbTvShow?.name} ${mmRecognizedByFolderName.tmdbTvShow?.id}`)
           return mmRecognizedByFolderName;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`, error)
    }

    return {
        success: false,
    }
}
