import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeMediaFolderByFolderName } from "./recognizeMediaFolderByFolderName";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import { getTvShowById } from "@/api/tmdb";


function fillTypeInMediaMetadata(_in_out_mm: UIMediaMetadata) {
    const mm = _in_out_mm;
    if(mm.tmdbTvShow !== undefined) {
        mm.type = 'tvshow-folder';
    } else if(mm.tmdbMovie !== undefined) {
        mm.type = 'movie-folder';
    }
}

export async function recognizeMediaFolder(_in_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {

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
            mm.tmdbMovie = ret.tmdbMovie;
        }
    } catch (error) {
        console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    //2.: try to recognize media folder by TMDB ID in folder name
    if(mm.tmdbTvShow === undefined && mm.tmdbMovie === undefined) {
        try {
            const ret = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, signal)
            if(ret.tmdbTvShow !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized TV show by TMDB ID in folder name: ${ret.tmdbTvShow.name} ${ret.tmdbTvShow.id}`)
                mm.tmdbTvShow = ret.tmdbTvShow;
            }
            if(ret.tmdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by TMDB ID in folder name: ${ret.tmdbMovie.title} ${ret.tmdbMovie.id}`)
                mm.tmdbMovie = ret.tmdbMovie;
            }
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
        }
    }

    //3. try to recognize media folder by folder name
    if(mm.tmdbTvShow === undefined && mm.tmdbMovie === undefined) {
        try {
            const ret = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')
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
                }
            } else if(ret.tmdbMovie !== undefined) {
                console.log(`[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tmdbMovie.title} ${ret.tmdbMovie.id}`)
                mm.tmdbMovie = ret.tmdbMovie;
            }
        } catch (error) {
            console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`, error)
        }
    }

    fillTypeInMediaMetadata(mm);
    return mm;
}
