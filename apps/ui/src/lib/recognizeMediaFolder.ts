import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeMediaFolderBySearchingFolderNameInTMDB } from "./tryToRecognizeMediaFolderBySearchingFolderNameInTMDB";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import { getTvShowById } from "@/api/tmdb";
import { tryToRecognizeMediaFolderByTvdbIdInFolderName } from "./recognizeMediaFolderByTvdbIdInFolderName";
import type { PreferMediaLanguage } from "@core/types";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";
import { tryToRecognizeMediaFolderBySearchingFolderNameInTVDB } from "./tryToRecognizeMediaFolderBySearchingFolderNameInTVDB";


function fillTypeInMediaMetadata(_in_out_mm: UIMediaMetadata) {
    const mm = _in_out_mm;
    if(mm.tmdbTvShow !== undefined || mm.tvShow !== undefined) {
        mm.type = 'tvshow-folder';
    } else if(mm.tmdbMovie !== undefined || mm.movie !== undefined) {
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
            console.log(`[recognizeMediaFolder] successfully recognized media folder by NFO: ${ret.tmdbTvShow?.name} ${ret.tmdbTvShow?.id}`)
            mm.mediaFiles = ret.mediaFiles;
            mm.tmdbTvShow = ret.tmdbTvShow;
            mm.tvShow = ret.tvShow ?? (ret.tmdbTvShow !== undefined ? tvShowMediaMetadataFromTmdbDetails(ret.tmdbTvShow) : undefined);
            mm.tmdbMovie = ret.tmdbMovie;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    const isRecognized = (mm: UIMediaMetadata) => {
        return mm.tmdbTvShow !== undefined || mm.tmdbMovie !== undefined || mm.tvShow !== undefined || mm.movie !== undefined;
    }

    const language = preferLanguage ?? 'en-US';
    //2.: try to recognize media folder by TMDB ID in folder name
    if(!isRecognized(mm) && folderPath.includes('tmdbid=')) {
        try {
            const ret = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, language, signal)
            if(ret.tmdbTvShow !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized TV show by TMDB ID in folder name: ${ret.tmdbTvShow.name} ${ret.tmdbTvShow.id}`)
                
            }
            if(ret.tmdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by TMDB ID in folder name: ${ret.tmdbMovie.title} ${ret.tmdbMovie.id}`)
                
            }
            mm.tmdbTvShow = ret.tmdbTvShow;
            mm.tvShow =
                ret.tmdbTvShow !== undefined ? tvShowMediaMetadataFromTmdbDetails(ret.tmdbTvShow) : undefined;
            mm.tmdbMovie = ret.tmdbMovie;
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
                const resp = await getTvShowById(ret.tmdbTvShow.id, 'zh-CN')
                if(resp.error) {
                    console.error(`[recognizeMediaFolder] Error in getTvShowById:`, resp.error)
                } else if(resp.data === undefined) {
                    console.error(`[recognizeMediaFolder] Error in getTvShowById:`, resp)
                } else {
                    console.log(`[recognizeMediaFolder] successfully recognized TV show by folder name: ${ret.tmdbTvShow.name} ${ret.tmdbTvShow.id}`)
                    mm.tmdbTvShow = resp.data;
                    mm.tvShow = tvShowMediaMetadataFromTmdbDetails(resp.data);
                }
            } else if(ret.tmdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tmdbMovie.title} ${ret.tmdbMovie.id}`)
                mm.tmdbMovie = ret.tmdbMovie;
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
