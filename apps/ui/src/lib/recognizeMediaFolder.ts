import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeMediaFolderBySearchingFolderNameInTMDB } from "./tryToRecognizeMediaFolderBySearchingFolderNameInTMDB";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import { tryToRecognizeMediaFolderByTvdbIdInFolderName } from "./recognizeMediaFolderByTvdbIdInFolderName";
import type { PreferMediaLanguage } from "@core/types";
import { tryToRecognizeMediaFolderBySearchingFolderNameInTVDB } from "./tryToRecognizeMediaFolderBySearchingFolderNameInTVDB";
import { getTvShowByIdFromTMDB } from "./TmdbUtils";


function fillTypeInMediaMetadata(_in_out_mm: UIMediaMetadata) {
    const mm = _in_out_mm;
    if(mm.tvShow !== undefined) {
        mm.type = 'tvshow-folder';
    } else if(mm.movie !== undefined) {
        mm.type = 'movie-folder';
    }
}

export async function recognizeMediaFolder(_in_mm: UIMediaMetadata, preferLanguage?: PreferMediaLanguage, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {

    console.log(`[recognizeMediaFolder] CALLED: preferLanguage=${preferLanguage}`)

    const mm = structuredClone(_in_mm);
    const folderPath = mm.mediaFolderPath!;
    console.log(`[recognizeMediaFolder] recognize media folder: ${folderPath}`)
    
    //1. try to recognize media folder by NFO
    try {
        const ret = await tryToRecognizeMediaFolderByNFO(mm, signal)
        if(ret !== undefined) {
            console.log(`[recognizeMediaFolder] successfully recognized media folder by NFO: ${ret.tvShow?.name} ${ret.tvShow?.id}`)
            mm.mediaFiles = ret.mediaFiles;
            mm.tvShow = ret.tvShow;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    const isRecognized = (mm: UIMediaMetadata) => {
        return mm.tvShow !== undefined || mm.movie !== undefined;
    }

    const language = preferLanguage ?? 'en-US';
    //2.: try to recognize media folder by TMDB ID in folder name
    if(!isRecognized(mm) && folderPath.includes('tmdbid=')) {
        try {
            const ret = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, language, signal)
            if(ret.tvShow !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized TV show by TMDB ID in folder name: ${ret.tvShow.name} ${ret.tvShow.id}`)
                
            }
            if(ret.movie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by TMDB ID in folder name: ${ret.movie.name} ${parseInt(ret.movie.id)}`)
                
            }
            mm.tvShow = ret.tvShow;
            mm.movie = ret.movie;
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
        }
    }

    //3. try to recognize media folder by TVDB ID in folder name
    if(!isRecognized(mm) && folderPath.includes('tvdbid=')) {
        try {
            const ret = await tryToRecognizeMediaFolderByTvdbIdInFolderName(folderPath, _in_mm.type === 'tvshow-folder' ? 'tvshow' : 'movie', language, signal)
            if(ret.tvdbTvShow !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized TV show by TVDB ID in folder name: ${ret.tvdbTvShow.name} ${ret.tvdbTvShow.id}`)   
            }
            if(ret.tvdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by TVDB ID in folder name: ${ret.tvdbMovie.name} ${ret.tvdbMovie.id}`)
            }
            mm.tvShow = ret.tvdbTvShow;
            mm.movie = ret.tvdbMovie;
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTvdbIdInFolderName:`, error)
        }
    }

    //4. try to recognize media folder by searching folder name in TMDB
    if(!isRecognized(mm)) {
        try {
            const ret = await tryToRecognizeMediaFolderBySearchingFolderNameInTMDB(folderPath, language)
            if(ret.tmdbTvShow !== undefined) {
                console.log(`[recognizeMediaFolder] trying to get TV show by ID: ${ret.tmdbTvShow.id}`)
                // TODO: use preferMediaLanguage in UserConfig
                const tvShow = await getTvShowByIdFromTMDB(parseInt(ret.tmdbTvShow.id), 'zh-CN')
                mm.tvShow = tvShow;
            } else if(ret.tmdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tmdbMovie.name} ${parseInt(ret.tmdbMovie.id)}`)
                mm.movie = ret.tmdbMovie;
            }
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`, error)
        }
    }

    // 5. try to recognize media folder by searching folder name in TVDB
    if(!isRecognized(mm)) {
        try {
            const ret = await tryToRecognizeMediaFolderBySearchingFolderNameInTVDB(folderPath, language)
            if(ret.tvdbTvShow !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized TV show by folder name: ${ret.tvdbTvShow.name} ${ret.tvdbTvShow.id}`)
            }
            if(ret.tvdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tvdbMovie.name} ${ret.tvdbMovie.id}`)
            }
            mm.tvShow = ret.tvdbTvShow;
            mm.movie = ret.tvdbMovie;
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderBySearchingFolderNameInTVDB:`, error)
        }
    }

    fillTypeInMediaMetadata(mm);

    console.log(`recognizeMediaFolder RETURNED: ${JSON.stringify(mm)}`)

    return mm;
}
