import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import {
    tryToRecognizeMovieFolderBySearchingFolderNameInTMDB,
    tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB,
} from "./tryToRecognizeMediaFolderBySearchingFolderNameInTMDB";
import { tryToRecognizeMediaFolderByNFO } from "./recognizeMediaFolderByNFO";
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from "./recognizeMediaFolderByTmdbIdInFolderName";
import { tryToRecognizeMediaFolderByTvdbIdInFolderName } from "./recognizeMediaFolderByTvdbIdInFolderName";
import type { PreferMediaLanguage, PrimaryDatabase, TvShowMediaMetadata } from "@core/types";
import {
    tryToRecognizeMovieFolderBySearchingFolderNameInTVDB,
    tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB,
} from "./tryToRecognizeMediaFolderBySearchingFolderNameInTVDB";

function fillTypeInMediaMetadata(_in_out_mm: UIMediaMetadata) {
    const mm = _in_out_mm;
    if(mm.tvShow !== undefined) {
        mm.type = 'tvshow-folder';
    } else if(mm.movie !== undefined) {
        mm.type = 'movie-folder';
    }
}

export async function recognizeMediaFolder(
    _in_mm: UIMediaMetadata,
    getTvShowByIdFromTmdbFn: (id: number, language?: PreferMediaLanguage) => Promise<TvShowMediaMetadata>,
    getTvShowByIdFromTvdbFn: (
        seriesId: number,
        language?: PreferMediaLanguage
    ) => Promise<TvShowMediaMetadata>,
    preferLanguage?: PreferMediaLanguage,
    primaryDatabase?: PrimaryDatabase,
    signal?: AbortSignal,
): Promise<UIMediaMetadata | undefined> {

    console.log(
        `[recognizeMediaFolder] CALLED: preferLanguage=${preferLanguage}, primaryDatabase=${primaryDatabase ?? "undefined"}`,
    )

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

    const isRecognized = (m: UIMediaMetadata) => {
        return m.tvShow !== undefined || m.movie !== undefined;
    }

    const check = (phaseName: string) => {
        if(isRecognized(mm)) {
            console.log(`[HIT] ${phaseName}`)
        } else {
            console.log(`[MISS] ${phaseName}`)
        }
    }

    check(`recognize by nfo`);

    const language = preferLanguage ?? 'en-US';

    const runTmdbIdInFolderNamePhase = async () => {
        if (!isRecognized(mm) && folderPath.includes('tmdbid=')) {
            try {
                const ret = await tryToRecognizeMediaFolderByTmdbIdInFolderName(getTvShowByIdFromTmdbFn, folderPath, language)
                if (ret.tvShow !== undefined) {
                    console.log(`[recognizeMediaFolder] successfully recognized TV show by TMDB ID in folder name: ${ret.tvShow.name} ${ret.tvShow.id}`)
                }
                if (ret.movie !== undefined) {
                    console.log(`[recognizeMediaFolder] successfully recognized movie by TMDB ID in folder name: ${ret.movie.name} ${parseInt(ret.movie.id)}`)
                }
                mm.tvShow = ret.tvShow;
                mm.movie = ret.movie;
            } catch (error) {
                console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
            }
        }
    }

    const runTvdbIdInFolderNamePhase = async () => {
        if (!isRecognized(mm) && folderPath.includes('tvdbid=')) {
            try {
                const ret = await tryToRecognizeMediaFolderByTvdbIdInFolderName(folderPath, _in_mm.type === 'tvshow-folder' ? 'tvshow' : 'movie', language, getTvShowByIdFromTvdbFn, signal)
                if (ret.tvdbTvShow !== undefined) {
                    console.log(`[recognizeMediaFolder] successfully recognized TV show by TVDB ID in folder name: ${ret.tvdbTvShow.name} ${ret.tvdbTvShow.id}`)
                }
                if (ret.tvdbMovie !== undefined) {
                    console.log(`[recognizeMediaFolder] successfully recognized movie by TVDB ID in folder name: ${ret.tvdbMovie.name} ${ret.tvdbMovie.id}`)
                }
                mm.tvShow = ret.tvdbTvShow;
                mm.movie = ret.tvdbMovie;
            } catch (error) {
                console.error(`[recognizeMediaFolder] Error in tryToRecognizeMediaFolderByTvdbIdInFolderName:`, error)
            }
        }
    }

    const runTmdbFolderNameSearchPhase = async () => {
        if (!isRecognized(mm)) {
            try {
                if (_in_mm.type === 'tvshow-folder') {
                    const ret = await tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB(folderPath, language)
                    if (ret.success) {
                        console.log(`[recognizeMediaFolder] trying to get TV show by ID: ${ret.tmdbTvShow.id}`)
                        const tvShow = await getTvShowByIdFromTmdbFn(parseInt(ret.tmdbTvShow.id), preferLanguage)
                        mm.tvShow = tvShow;
                    }
                } else if (_in_mm.type === 'movie-folder') {
                    const ret = await tryToRecognizeMovieFolderBySearchingFolderNameInTMDB(folderPath, language)
                    if (ret.success) {
                        console.log(`[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tmdbMovie.name} ${parseInt(ret.tmdbMovie.id)}`)
                        mm.movie = ret.tmdbMovie;
                    }
                }
            } catch (error) {
                console.error(`[recognizeMediaFolder] Error in TMDB folder-name search:`, error)
            }
        }
    }

    const runTvdbFolderNameSearchPhase = async () => {
        if (!isRecognized(mm)) {
            try {
                if (_in_mm.type === 'tvshow-folder') {
                    const ret = await tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB(
                        folderPath,
                        getTvShowByIdFromTvdbFn,
                        language,
                    )
                    if (ret.success) {
                        console.log(
                            `[recognizeMediaFolder] successfully recognized TV show by folder name: ${ret.tvdbTvShow.name} ${ret.tvdbTvShow.id}`,
                        )
                        mm.tvShow = ret.tvdbTvShow
                    }
                } else if (_in_mm.type === 'movie-folder') {
                    const ret = await tryToRecognizeMovieFolderBySearchingFolderNameInTVDB(
                        folderPath,
                        language,
                    )
                    if (ret.success) {
                        console.log(
                            `[recognizeMediaFolder] successfully recognized movie by folder name: ${ret.tvdbMovie.name} ${ret.tvdbMovie.id}`,
                        )
                        mm.movie = ret.tvdbMovie
                    }
                }
            } catch (error) {
                console.error(`[recognizeMediaFolder] Error in TVDB folder-name search:`, error)
            }
        }
    }

    // 2–3. ID in folder name: fixed order (primaryDatabase does not apply)
    await runTmdbIdInFolderNamePhase()
    check(`recognize by tmdb id in folder name`);
    await runTvdbIdInFolderNamePhase()
    check(`recognize by tvdb id in folder name`);

    // 4–5. Search by folder name: primaryDatabase picks TMDB vs TVDB order; undefined → TMDB then TVDB
    if (primaryDatabase === "TVDB") {
        await runTvdbFolderNameSearchPhase()
        check(`recognize by tvdb folder name`);
        await runTmdbFolderNameSearchPhase()
        check(`recognize by tmdb folder name`);
    } else {
        await runTmdbFolderNameSearchPhase()
        check(`recognize by tmdb folder name`);
        await runTvdbFolderNameSearchPhase()
        check(`recognize by tvdb folder name`);
    }

    fillTypeInMediaMetadata(mm);

    console.log(`recognizeMediaFolder RETURNED: ${JSON.stringify(mm)}`)

    return mm;
}
