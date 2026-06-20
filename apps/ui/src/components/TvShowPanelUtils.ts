import type { MediaFileMetadata, MediaMetadata, PrimaryDatabase, TMDBEpisode, TMDBTVShowDetails, TvShowMediaMetadata } from "@core/types";
import { type UIMediaMetadata } from "@/types/UIMediaMetadata";
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { cleanupRecognizePlan } from "@/ai/tools/EndRecognizeTask";
import { extname, join } from "@/lib/path";
import { Path } from "@core/path";
import { getFullExtensionForAssociatedFile } from "@core/utils";
import { findAssociatedFiles, requireFieldsNonUndefined, nextTraceId } from "@/lib/utils";

/**
 * Compare two media folder paths for equality after normalizing to POSIX.
 * Used so plan.mediaFolderPath and mediaMetadata.mediaFolderPath match regardless of trailing slash or platform format.
 */
export function mediaFolderPathEqual(a: string | undefined, b: string | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return Path.posix(a) === Path.posix(b);
  } catch {
    return a === b;
  }
}
import type { FileProps } from "@/lib/types";
import { readFile } from "@/api/readFile";
import { parseEpisodeNfo } from "@/lib/nfo";
import { renameFiles as renameFilesApi } from "@/api/renameFiles";
import type { PlanStatus } from "@core/types/planCommon";
import type { RecognizeMediaFilePlan, RecognizedFile } from "@core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan";
import { toast } from "sonner";
import { recognizeEpisodesAsync } from "@/lib/recognizeEpisodes";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata";

export function mapTagToFileType(tag: "VID" | "SUB" | "AUD" | "NFO" | "POSTER" | ""): "file" | "video" | "subtitle" | "audio" | "nfo" | "poster" {
    switch(tag) {
        case "VID":
            return "video"
        case "SUB":
            return "subtitle"
        case "AUD":
            return "audio"
        case "NFO":
            return "nfo"
        case "POSTER":
            return "poster"
        default:
            return "file"
    }
}

export function newPath(mediaFolderPath: string, videoFilePath: string, associatedFilePath: string): string {
    const videoFileExtension = extname(videoFilePath)
    const associatedFileExtension = getFullExtensionForAssociatedFile(associatedFilePath)
    const videoRelativePath = videoFilePath.replace(mediaFolderPath + '/', '')
    const associatedRelativePath = videoRelativePath.replace(videoFileExtension, associatedFileExtension)
    return join(mediaFolderPath, associatedRelativePath)
}

/**
 * Build FileProps[] for an episode from a video path: video file plus associated files (subtitle, nfo, poster, etc.).
 * Used when building SeasonModel preview from recognized paths (rule-based or plan-based).
 */
export function buildFilePropsForVideoPath(
  mediaFolderPath: string,
  fileList: string[],
  videoFilePath: string
): FileProps[] {
  if (!mediaFolderPath || fileList.length === 0) {
    return [{ type: "video", path: videoFilePath }]
  }
  const associatedFiles = findAssociatedFiles(mediaFolderPath, fileList, videoFilePath)
  return [
    { type: "video", path: videoFilePath },
    ...associatedFiles.map((file) => ({
      type: mapTagToFileType(file.tag),
      path: join(mediaFolderPath, file.path),
    })),
  ]
}

export function buildFileProps(mm: UIMediaMetadata, seasonNumber: number, episodeNumber: number): FileProps[] {
    if(mm.mediaFolderPath === undefined) {
        console.error(`Media folder path is undefined`)
        throw new Error(`Media folder path is undefined`)
    }

    if(mm.mediaFiles === undefined) {
        return [];
    }

    if(mm.files === undefined || mm.files === null) {
        return [];
    }

    const mediaFile: MediaFileMetadata | undefined = mm.mediaFiles?.find(file => file.seasonNumber === seasonNumber && file.episodeNumber === episodeNumber)

    if(!mediaFile) {
        return [];
    }

    const episodeVideoFilePath = mediaFile.absolutePath

    const files = findAssociatedFiles(mm.mediaFolderPath, mm.files, episodeVideoFilePath)

    const fileProps: FileProps[] = [
        {
            type: "video",
            path: mediaFile.absolutePath,
        },
        ...files.map(file => ({
            type: mapTagToFileType(file.tag),
            // Convert relative path to absolute path
            path: join(mm.mediaFolderPath!, file.path),
        }))
    ];

    return fileProps;
}

export function renameFiles(mediaFolderPath: string, newVideoFilePath: string,files: FileProps[])
: FileProps[] 
 {
  const relativeVideoFilePath = newVideoFilePath.replace(mediaFolderPath + '/', '');
  const videoFileExtension = extname(newVideoFilePath);
  const relativeVideoFilePathWithoutExtension = relativeVideoFilePath.replace(videoFileExtension, '');

  const videoFile = files.find(file => file.type === "video");
  if(!videoFile) {
    return [];
  }

  const associatedFiles = 
      files.filter(file => file.type !== "video")
      .map(file => {
        const associatedFileExtension = getFullExtensionForAssociatedFile(file.path);
        file.newPath = join(mediaFolderPath, relativeVideoFilePathWithoutExtension + associatedFileExtension);
        const newObj: FileProps = {
          type: file.type,
          path: file.path,
          newPath: file.newPath,
        }
        return newObj;
      })

  return [
    {
      type: "video",
      path: videoFile.path,
      newPath: newVideoFilePath,
    },
    ...(associatedFiles ?? []),
  ]
}

/**
 * Update media file metadata array by adding or updating an entry for a video file.
 * If the video file already exists in the array, update its season/episode numbers.
 * Otherwise, add a new entry.
 * @return new array of media files
 */
export function updateMediaFileMetadatas(
    mediaFiles: MediaFileMetadata[],
    videoFilePath: string,
    seasonNumber: number,
    episodeNumber: number
): MediaFileMetadata[] {

    // There are two possible cases:
    // 1. The video file has been assigned to one episode
    // 2. The episode has been assigned by another video file

    const newMediaFiles: MediaFileMetadata[] = mediaFiles
        .filter(mediaFile => mediaFile.seasonNumber !== seasonNumber || mediaFile.episodeNumber !== episodeNumber)
        .filter(mediaFile => mediaFile.absolutePath !== videoFilePath);

    newMediaFiles.push({
        absolutePath: videoFilePath,
        seasonNumber,
        episodeNumber
    });

    return newMediaFiles;
    
}

/**
 * Apply a RecognizeMediaFilePlan to media metadata and persist via `persist`.
 * Caller is responsible for validation and must pass a traceId so the event origin is visible (e.g. TvShowPanel-handleAiRecognizeConfirm-...).
 */
export async function applyRecognizeMediaFilePlan(
    plan: RecognizeMediaFilePlan,
    mediaMetadata: MediaMetadata,
    persist: PersistUIMediaMetadataFn,
    options: { traceId: string }
): Promise<void> {
    let updatedMediaFiles = mediaMetadata.mediaFiles ?? [];
    for (const recognizedFile of plan.files) {
        updatedMediaFiles = updateMediaFileMetadatas(
            updatedMediaFiles,
            recognizedFile.path,
            recognizedFile.season,
            recognizedFile.episode
        );
    }
    const updatedMetadata: MediaMetadata = {
        ...mediaMetadata,
        mediaFiles: updatedMediaFiles,
    };
    console.log(`[applyRecognizeMediaFilePlan] updatedMetadata:`, structuredClone(updatedMetadata))
    await persist(mediaMetadata.mediaFolderPath!, updatedMetadata, { traceId: options.traceId })
}

export function rebuildPlanWithSelectedEpisodes(
    originalPlan: RecognizeMediaFilePlan,
    selectedEpisodes: {season: number, episode: number}[]
): RecognizeMediaFilePlan {
    if (selectedEpisodes.length === 0) {
        return originalPlan
    }

    const selectedSet = new Set(selectedEpisodes.map(e => `${e.season}-${e.episode}`))
    const filteredFiles = originalPlan.files.filter(file => 
        selectedSet.has(`${file.season}-${file.episode}`)
    )

    return {
        ...originalPlan,
        files: filteredFiles
    }
}

export function rebuildRenamePlanWithSelectedEpisodes(
    originalPlan: RenameFilesPlan,
    selectedEpisodePaths: string[]
): RenameFilesPlan {
  
  return {
    ...originalPlan,
    files: originalPlan.files.filter(file => {
      return selectedEpisodePaths.some(path => path === file.from)
    })
  }

}

/**
 * Try to regcognize media folder by NFO. 
 * @param mediaFolderPath 
 * @param signal optional AbortSignal to cancel the operation
 * @returns return undefined if not recognizable
 */
export async function tryToRecognizeTvShowFolderByNFO(_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {

    const mm = structuredClone(_mm)
    
    if(mm.files === undefined || mm.files === null) {
        console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: files is undefined or null`)
        return undefined
    }

    mm.mediaFiles = mm.mediaFiles ?? [];

    const nfoFilePath = mm.files.find(file => file.endsWith('/tvshow.nfo'))
    if(nfoFilePath === undefined) {
        console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: tvshow.nfo not found`)
        return undefined
    }

    const resp = await readFile(Path.toPlatformPath(nfoFilePath), signal)

    if(resp.error) {
        console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to read tvshow.nfo file: ${nfoFilePath}`, resp.error)
        return undefined
    }
    if(resp.data === undefined) {
        console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unexpected response body: no data`, resp)
        return undefined
    }
    
    mm.tvShow = buildTvShowMediaMetadataByNFO(resp.data)

    const episodeNfoFiles = mm.files.filter(file => file.endsWith('.nfo') && !file.endsWith('/tvshow.nfo'))
    if(episodeNfoFiles.length === 0) {
        console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: no episode NFO files found`)
        return undefined
    }

    
    for(const episodeNfoFile of episodeNfoFiles) {
        if (signal?.aborted) {
            return undefined
        }
        const resp = await readFile(episodeNfoFile, signal, { requireValidate: false})
        if(resp.error) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to read episode NFO file: ${episodeNfoFile}`, resp.error)
            continue
        }
        if(resp.data === undefined) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unexpected response body: no data`, resp)
            continue
        }
        const xml = resp.data
        let episodeNfo
        try {
            episodeNfo = await parseEpisodeNfo(xml)
        } catch (error) {
            console.warn(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: error parsing episode NFO file: ${episodeNfoFile}`, error)
            continue
        }
        
        if(episodeNfo === undefined) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to parse episode NFO file: ${episodeNfoFile}`)
            continue
        }

        try {
            requireFieldsNonUndefined(episodeNfo, 'season', 'episode', 'originalFilename')
        } catch(error) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: missing required fields in episode NFO file: ${episodeNfoFile}`, error)
            continue
        }

        // TODO: remove tmdbTvShow
        if(mm.tvShow !== undefined) {
            const { season } = episodeNfo
            
            let tmdbSeason = mm.tvShow.seasons.find(_season => _season.season === season)
            if(tmdbSeason === undefined) {
              tmdbSeason = {
                season: season!,
                name: '',
                episodes: [],
              }
              mm.tvShow.seasons.push(tmdbSeason)
            }

            if(tmdbSeason.episodes === undefined) {
                tmdbSeason.episodes = []
            }

            const tmdbEpisode = buildTmdbEpisodeByNFO(xml)
            if(tmdbEpisode === undefined) {
                console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to build tmdbEpisode from NFO file: ${episodeNfoFile}`)
                continue
            }
            tmdbSeason.episodes.push({
              season: tmdbEpisode.season_number!,
              episode: tmdbEpisode.episode_number!,
              name: tmdbEpisode.name ?? '',
            })

        } else {
            console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: tmdbTvShow is undefined, cannot build tmdbEpisode`)
        }

        console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: found episode S${episodeNfo.season}E${episodeNfo.episode} "${episodeNfo.originalFilename}"`)
        const mediaFileAbsPath = mm.files.find(file => file.endsWith(episodeNfo.originalFilename!))
        if(mediaFileAbsPath === undefined) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: media file not found: ${episodeNfo.originalFilename}`)
        }
        mm.mediaFiles = updateMediaFileMetadatas(mm.mediaFiles, mediaFileAbsPath!, episodeNfo.season!, episodeNfo.episode!)
    }

    return mm;
}

/**
 * Extracts the path portion from a TMDB image URL.
 * Handles both full URLs (https://image.tmdb.org/t/p/{size}{path}) and paths that are already just the path.
 * 
 * @param urlOrPath - Full TMDB image URL or just the path
 * @returns The path portion (e.g., "/mNuV7Jti0jYQh34OP2WdmhflTDQ.jpg") or null if invalid
 */
function extractTmdbImagePath(urlOrPath: string | undefined | null): string | null {
    if (!urlOrPath) return null
    
    // If it's already just a path (starts with /), return it
    if (urlOrPath.startsWith('/')) {
        return urlOrPath
    }
    
    // If it's a full URL, extract the path portion
    // Pattern: https://image.tmdb.org/t/p/{size}{path}
    const tmdbImagePattern = /^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/
    const match = urlOrPath.match(tmdbImagePattern)
    
    if (match && match[1]) {
        return match[1]
    }
    
    // If it doesn't match the pattern, try to extract path from URL
    try {
        const url = new URL(urlOrPath)
        return url.pathname
    } catch {
        // If URL parsing fails, return null
        return null
    }
}

export function buildTmdbEpisodeByNFO(episodeNfoXml: string): TMDBEpisode | undefined {
    const parser = new DOMParser()
    const doc = parser.parseFromString(episodeNfoXml, 'text/xml')
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
        console.error(`[buildTmdbEpisodeByNFO] Failed to parse XML: ${parseError.textContent}`)
        return undefined
    }
    
    const episode = doc.querySelector('episodedetails')
    if (!episode) {
        return undefined
    }
    
    // Helper function to get text content from an element
    const getTextContent = (selector: string): string | undefined => {
        const element = episode.querySelector(selector)
        return element?.textContent?.trim() || undefined
    }
    
    // Extract ID - prefer uniqueid with type="tmdb", fallback to id
    let id = 0
    const tmdbUniqueId = episode.querySelector('uniqueid[type="tmdb"]')
    if (tmdbUniqueId) {
        const idText = tmdbUniqueId.textContent?.trim()
        if (idText) {
            const parsedId = parseInt(idText, 10)
            if (!isNaN(parsedId)) {
                id = parsedId
            }
        }
    }
    
    // Fallback to id element if tmdb uniqueid not found
    if (id === 0) {
        const idText = getTextContent('id')
        if (idText) {
            const parsedId = parseInt(idText, 10)
            if (!isNaN(parsedId)) {
                id = parsedId
            }
        }
    }
    
    // Extract name (title)
    const name = getTextContent('title') || ''
    
    // Extract overview (plot)
    const overview = getTextContent('plot') || ''
    
    // Extract still_path (thumb) - extract path from URL
    const thumbUrl = getTextContent('thumb')
    const still_path = extractTmdbImagePath(thumbUrl)
    
    // Extract air_date (prefer premiered, fallback to aired)
    const air_date = getTextContent('premiered') || getTextContent('aired') || ''
    
    // Extract episode_number
    let episode_number = 0
    const episodeText = getTextContent('episode')
    if (episodeText) {
        const parsedEpisode = parseInt(episodeText, 10)
        if (!isNaN(parsedEpisode)) {
            episode_number = parsedEpisode
        }
    }
    
    // Extract season_number
    let season_number = 0
    const seasonText = getTextContent('season')
    if (seasonText) {
        const parsedSeason = parseInt(seasonText, 10)
        if (!isNaN(parsedSeason)) {
            season_number = parsedSeason
        }
    }
    
    // Extract vote_average and vote_count from ratings
    let vote_average = 0
    let vote_count = 0
    const rating = episode.querySelector('ratings > rating[name="themoviedb"]')
    if (rating) {
        const valueElement = rating.querySelector('value')
        const votesElement = rating.querySelector('votes')
        
        if (valueElement) {
            const valueText = valueElement.textContent?.trim()
            if (valueText) {
                const parsedValue = parseFloat(valueText)
                if (!isNaN(parsedValue)) {
                    vote_average = parsedValue
                }
            }
        }
        
        if (votesElement) {
            const votesText = votesElement.textContent?.trim()
            if (votesText) {
                const parsedVotes = parseInt(votesText, 10)
                if (!isNaN(parsedVotes)) {
                    vote_count = parsedVotes
                }
            }
        }
    }
    
    // Extract runtime
    let runtime = 0
    const runtimeText = getTextContent('runtime')
    if (runtimeText) {
        const parsedRuntime = parseInt(runtimeText, 10)
        if (!isNaN(parsedRuntime)) {
            runtime = parsedRuntime
        }
    }
    
    // Build and return TMDBEpisode
    const tmdbEpisode: TMDBEpisode = {
        id,
        name,
        overview,
        still_path,
        air_date,
        episode_number,
        season_number,
        vote_average,
        vote_count,
        runtime,
    }
    
    return tmdbEpisode
}


function parseTvShowNfoDocument(tvshowNfoXml: string): Document | undefined {
    const parser = new DOMParser()
    const doc = parser.parseFromString(tvshowNfoXml, "text/xml")
    const parseError = doc.querySelector("parsererror")
    if (parseError) {
        console.error(`[buildTvShowMediaMetadataByNFO] Failed to parse XML: ${parseError.textContent}`)
        return undefined
    }
    return doc
}

/**
 * Reads show id and database from tvshow.nfo (Kodi / TinyMediaManager style).
 * Prefers TMDB when a TMDB id is present; otherwise uses TVDB from uniqueids or episodeguide JSON.
 */
function extractTvShowIdentityFromElement(
    tvshow: Element,
): { id: string; name: string; database: "TMDB" | "TVDB" } | undefined {
    const getTextContent = (selector: string): string | undefined => {
        const element = tvshow.querySelector(selector)
        return element?.textContent?.trim() || undefined
    }

    let tmdbId = 0
    const tmdbUniqueId = tvshow.querySelector('uniqueid[type="tmdb"]')
    if (tmdbUniqueId) {
        const idText = tmdbUniqueId.textContent?.trim()
        if (idText) {
            const parsedId = parseInt(idText, 10)
            if (!isNaN(parsedId)) tmdbId = parsedId
        }
    }

    if (tmdbId === 0) {
        const tmdbidText = getTextContent("tmdbid")
        if (tmdbidText) {
            const parsedId = parseInt(tmdbidText, 10)
            if (!isNaN(parsedId)) tmdbId = parsedId
        }
    }

    const egText = getTextContent("episodeguide")
    if (tmdbId === 0 && egText) {
        try {
            const j = JSON.parse(egText) as { tmdb?: string }
            if (j.tmdb) {
                const parsedId = parseInt(j.tmdb, 10)
                if (!isNaN(parsedId)) tmdbId = parsedId
            }
        } catch {
            /* ignore invalid episodeguide JSON */
        }
    }

    let tvdbId = 0
    const tvdbNodes = [...tvshow.querySelectorAll('uniqueid[type="tvdb"]')]
    const defaultTvdb = tvdbNodes.filter((n) => n.getAttribute("default") === "true")
    const nodesToScan = defaultTvdb.length > 0 ? defaultTvdb : tvdbNodes
    for (const node of nodesToScan) {
        const t = node.textContent?.trim()
        if (t) {
            const parsedId = parseInt(t, 10)
            if (!isNaN(parsedId)) {
                tvdbId = parsedId
                break
            }
        }
    }

    if (tvdbId === 0 && egText) {
        try {
            const j = JSON.parse(egText) as { tvdb?: string }
            if (j.tvdb) {
                const parsedId = parseInt(j.tvdb, 10)
                if (!isNaN(parsedId)) tvdbId = parsedId
            }
        } catch {
            /* ignore */
        }
    }

    const rawIdText = getTextContent("id")
    if (tmdbId === 0 && tvdbId === 0 && rawIdText) {
        const parsedId = parseInt(rawIdText, 10)
        if (!isNaN(parsedId)) tmdbId = parsedId
    }

    const name = getTextContent("title") || ""

    if (tmdbId > 0) {
        return { id: String(tmdbId), name, database: "TMDB" }
    }
    if (tvdbId > 0) {
        return { id: String(tvdbId), name, database: "TVDB" }
    }
    return undefined
}

/** 
 * Builds {@link TvShowMediaMetadata} from a tvshow.nfo file (empty seasons; episodes come from elsewhere). 
 */
export function buildTvShowMediaMetadataByNFO(tvshowNfoXml: string): TvShowMediaMetadata | undefined {
    const doc = parseTvShowNfoDocument(tvshowNfoXml)
    if (!doc) return undefined
    const tvshow = doc.querySelector("tvshow")
    if (!tvshow) return undefined
    const identity = extractTvShowIdentityFromElement(tvshow)
    if (identity === undefined) return undefined
    return {
        id: identity.id,
        name: identity.name,
        database: identity.database,
        seasons: [],
    }
}

/**
 * @deprecated, use buildTvShowMediaMetadataByNFO instead
 * @param tvshowNfoXml 
 * @returns 
 */
export function buildTmdbTVShowDetailsByNFO(tvshowNfoXml: string): TMDBTVShowDetails | undefined {
    const parser = new DOMParser()
    const doc = parser.parseFromString(tvshowNfoXml, 'text/xml')
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
        console.error(`[buildTmdbTVShowDetailsByNFO] Failed to parse XML: ${parseError.textContent}`)
        return undefined
    }
    
    const tvshow = doc.querySelector('tvshow')
    if (!tvshow) {
        return undefined
    }
    
    // Helper function to get text content from an element
    const getTextContent = (selector: string): string | undefined => {
        const element = tvshow.querySelector(selector)
        return element?.textContent?.trim() || undefined
    }
    
    // Extract ID - prefer uniqueid with type="tmdb", fallback to tmdbid, then id
    let id = 0
    const tmdbUniqueId = tvshow.querySelector('uniqueid[type="tmdb"]')
    if (tmdbUniqueId) {
        const idText = tmdbUniqueId.textContent?.trim()
        if (idText) {
            const parsedId = parseInt(idText, 10)
            if (!isNaN(parsedId)) {
                id = parsedId
            }
        }
    }
    
    // Fallback to tmdbid element
    if (id === 0) {
        const tmdbidText = getTextContent('tmdbid')
        if (tmdbidText) {
            const parsedId = parseInt(tmdbidText, 10)
            if (!isNaN(parsedId)) {
                id = parsedId
            }
        }
    }
    
    // Fallback to id element
    if (id === 0) {
        const idText = getTextContent('id')
        if (idText) {
            const parsedId = parseInt(idText, 10)
            if (!isNaN(parsedId)) {
                id = parsedId
            }
        }
    }
    
    // Extract name (title)
    const name = getTextContent('title') || ''
    
    // Extract original_name (originaltitle)
    const original_name = getTextContent('originaltitle') || ''
    
    // Extract overview (plot)
    const overview = getTextContent('plot') || ''
    
    // Extract poster_path from thumb with aspect="poster" and no season attribute
    let poster_path: string | null = null
    const posterThumbs = tvshow.querySelectorAll('thumb[aspect="poster"]')
    for (const thumb of Array.from(posterThumbs)) {
        const seasonAttr = thumb.getAttribute('season')
        if (!seasonAttr) {
            const thumbUrl = thumb.textContent?.trim()
            if (thumbUrl) {
                poster_path = extractTmdbImagePath(thumbUrl)
                break
            }
        }
    }
    
    // Extract backdrop_path from fanart
    let backdrop_path: string | null = null
    const fanart = tvshow.querySelector('fanart')
    if (fanart) {
        const fanartThumb = fanart.querySelector('thumb')
        if (fanartThumb) {
            const fanartUrl = fanartThumb.textContent?.trim()
            if (fanartUrl) {
                backdrop_path = extractTmdbImagePath(fanartUrl)
            }
        }
    }
    
    // Fallback to fanart element if fanart/thumb structure not found
    if (!backdrop_path) {
        const fanartUrl = getTextContent('fanart')
        backdrop_path = extractTmdbImagePath(fanartUrl)
    }
    
    // Extract first_air_date (premiered)
    const first_air_date = getTextContent('premiered') || ''
    
    // Extract vote_average and vote_count from ratings
    let vote_average = 0
    let vote_count = 0
    const rating = tvshow.querySelector('ratings > rating[name="themoviedb"]')
    if (rating) {
        const valueElement = rating.querySelector('value')
        const votesElement = rating.querySelector('votes')
        
        if (valueElement) {
            const valueText = valueElement.textContent?.trim()
            if (valueText) {
                const parsedValue = parseFloat(valueText)
                if (!isNaN(parsedValue)) {
                    vote_average = parsedValue
                }
            }
        }
        
        if (votesElement) {
            const votesText = votesElement.textContent?.trim()
            if (votesText) {
                const parsedVotes = parseInt(votesText, 10)
                if (!isNaN(parsedVotes)) {
                    vote_count = parsedVotes
                }
            }
        }
    }
    
    // Extract origin_country from country elements
    const origin_country: string[] = []
    const countryElements = tvshow.querySelectorAll('country')
    for (const country of Array.from(countryElements)) {
        const countryText = country.textContent?.trim()
        if (countryText) {
            origin_country.push(countryText)
        }
    }
    
    // Extract status
    const status = getTextContent('status') || ''
    
    // Extract last_air_date (not directly in NFO, but we can try to infer from status or leave empty)
    const last_air_date = ''
    
    // Build and return TMDBTVShowDetails
    const tvShowDetails: TMDBTVShowDetails = {
        // Base TMDBTVShow fields
        id,
        name,
        original_name,
        overview,
        poster_path,
        backdrop_path,
        first_air_date,
        vote_average,
        vote_count,
        popularity: 0, // Not available in NFO
        genre_ids: [], // Genre names in NFO, can't map to IDs without API
        origin_country,
        media_type: 'tv',
        
        // TMDBTVShowDetails specific fields
        number_of_seasons: 0, // Not available in NFO
        number_of_episodes: 0, // Not available in NFO
        seasons: [], // Not available in NFO
        status,
        type: '', // Not available in NFO
        in_production: status.toLowerCase() !== 'ended', // Infer from status
        last_air_date,
        networks: [], // Not available in NFO
        production_companies: [], // Not available in NFO
    }
    
    return tvShowDetails
}


/**
 * @deprecated, use startToRenameFiles in useTvShowRenaming instead
 * @param plan 
 * @param mediaMetadata 
 * @returns 
 */
export async function executeRenamePlan(
  plan: RenameFilesPlan,
  mediaMetadata: UIMediaMetadata,
): Promise<void> {
  if (!mediaMetadata || !mediaFolderPathEqual(plan.mediaFolderPath, mediaMetadata.mediaFolderPath)) {
    toast.error("Plan does not match current media folder")
    return
  }
  const mediaFolderPath = mediaMetadata.mediaFolderPath
  if (!mediaFolderPath) {
    toast.error("Media folder path is not available")
    return
  }
  const traceId = `TvShowPanel-executeRenamePlan-${nextTraceId()}`

  if (plan.files.length === 0) {
    console.warn(`empty RenameFilesPlan, do nothing but mark plan as completed`)
  }

  try {
    // Pass platform-specific paths so the backend can perform file system operations correctly.
    // mediaFolder is used for metadata update and broadcast; files.from/to must be platform format.
    const response = await renameFilesApi({
      files: plan.files.map(({ from, to }) => ({
        from: Path.toPlatformPath(from),
        to: Path.toPlatformPath(to),
      })),
      traceId,
      mediaFolder: Path.toPlatformPath(mediaFolderPath),
    })

    if (response.error) {
      toast.error(response.error)
      return
    }

    const succeededPaths = response.data?.succeeded ?? []
    const failedPaths = response.data?.failed ?? []

    if (succeededPaths.length === 0) {
      toast.error(`Failed to rename ${failedPaths.length} file(s)`)
      return
    }

    const successCount = succeededPaths.length
    const errorCount = failedPaths.length

    if (errorCount === 0) {
      toast.success(`Successfully renamed ${successCount} file(s)`)
    } else {
      toast.warning(`Renamed ${successCount} file(s), ${errorCount} failed`)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    toast.error(`Failed to rename files: ${errorMessage}`)
  }
}

/**
 * Build a temporary recognition plan from the media metadata.
 * This is used for rule-based recognition where the frontend creates
 * episode-to-file mappings using the lookup utility.
 *
 * Note: We always use the lookup utility to find files, never rely on
 * existing mediaMetadata.mediaFiles because they may be incorrect
 * (file doesn't exist or mapping is wrong).
 *
 * @param mediaMetadata - The media metadata containing files and TV show info
 * @param lookup - Function to lookup files based on season/episode numbers
 * @returns A partial recognition plan with file mappings, or null if no files found
 *          The caller (addTmpPlan) will add id, task, status, and tmp fields
 */
export async function buildTemporaryRecognitionPlanAsync(
  mediaMetadata: MediaMetadata,
): Promise<(Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] }) | null> {
  if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files || !mediaMetadata.tvShow) {
    return null
  }

  const collected = await recognizeEpisodesAsync(mediaMetadata);

  return {
    mediaFolderPath: mediaMetadata.mediaFolderPath,
    files: collected.map(({ season, episode, file }) => ({
      season,
      episode,
      path: file,
    }))
  }
}




export interface HandlePendingPlansParams {
  pendingPlans: (UIRecognizeMediaFilePlan | UIRenameFilesPlan)[]
  mediaMetadata: MediaMetadata | undefined
  openAiBasedRecognizePrompt: (options: {
    status: "generating" | "wait-for-ack"
    confirmButtonLabel?: string
    confirmButtonDisabled?: boolean
    isRenaming?: boolean
    onConfirm?: () => void
    onCancel?: () => void
  }) => void
  closeAiBasedRecognizePrompt: () => void
  handleAiRecognizeConfirmCallback: (plan: RecognizeMediaFilePlan) => Promise<void>
  handleRuleBasedRecognizeConfirmCallback?: (plan: UIRecognizeMediaFilePlan) => void | Promise<void>
  updatePlan: (planId: string, status: PlanStatus) => Promise<void>
  toast: typeof toast
  /** When false, skip opening AI-based recognize prompts. */
  isAiFeatureEnabled?: boolean
}

/**
 * @param params 
 * @returns 
 */
export function handlePendingPlans(params: HandlePendingPlansParams): void {
  const {
    pendingPlans,
    mediaMetadata,
    openAiBasedRecognizePrompt,
    closeAiBasedRecognizePrompt,
    handleAiRecognizeConfirmCallback,
    updatePlan,
  } = params

  if (!mediaMetadata?.mediaFolderPath) {
    return
  }

  // AI features are disabled — close any open prompt and skip
  if (!params.isAiFeatureEnabled) {
    closeAiBasedRecognizePrompt()
    return
  }

  console.log(`[handlePendingPlans] pendingPlans: `, structuredClone(pendingPlans))

  // Only AI/MCP-created recognize plans are surfaced via AiBasedRecognizePrompt.
  // Rule-based (creator: 'app') plans are handled exclusively by
  // RuleBasedRecognizePrompt (opened directly from the recognize button), so
  // they must never trigger the AI prompt here.
  const plan = pendingPlans.find(
    p =>
      p.task === "recognize-media-file" &&
      p.creator === 'ai' &&
      (p.status === 'pending' || p.status === 'preparing') &&
      mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata.mediaFolderPath)
  )

  console.log(`[handlePendingPlans] plan: `, structuredClone(plan))
  
  if (plan) {
    openAiBasedRecognizePrompt({
        status: "wait-for-ack",
        confirmButtonLabel: 'Confirm',
        confirmButtonDisabled: false,
        isRenaming: false,
        onConfirm: () => handleAiRecognizeConfirmCallback(plan as RecognizeMediaFilePlan),
        onCancel: async () => {
          try {
            await updatePlan(plan.id, 'rejected')
            // Drop the in-memory AI draft for this plan.
            await cleanupRecognizePlan(plan.id)
          } catch (error) {
            console.error('[TvShowPanel] Error rejecting plan:', error)
          }
        }
      })
  } else {
    closeAiBasedRecognizePrompt()
  }
}

export interface OnMediaFolderSelectedParams {
  mediaMetadata: UIMediaMetadata
  /** Mirrors user config; undefined means try TMDB then TVDB in recognizeMediaFolder. */
  primaryDatabase?: PrimaryDatabase
  openRuleBasedRecognizePrompt: (options: {
    tvShowTitle: string
    tvShowTmdbId: number
    onConfirm?: () => void
    onCancel?: () => void
  }) => void
  updateMediaMetadata: (path: string, metadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata), options?: { traceId?: string }) => void
}

export interface UnlinkEpisodeParams {
  season: number,
  episode: number,
  mediaMetadata: MediaMetadata | undefined
  updateMediaMetadata: (path: string, metadata: MediaMetadata | ((current: MediaMetadata) => MediaMetadata), options?: { traceId?: string }) => Promise<void>
  t: (key: string, options?: Record<string, unknown>) => string
}

/**
 * Unlink the video file from an episode by removing its entry from mediaFiles.
 * Parses the row ID (e.g., "S01E01") to get season/episode numbers and filters
 * out the matching entry from mediaMetadata.mediaFiles.
 */
export function unlinkEpisode(params: UnlinkEpisodeParams): void {
  const { season, episode, mediaMetadata, updateMediaMetadata, t } = params

  if (!mediaMetadata?.mediaFolderPath || !mediaMetadata.mediaFiles) return

  // Filter out the media file entry for this episode
  const updatedMediaFiles = mediaMetadata.mediaFiles.filter(
    (mf) => !(mf.seasonNumber === season && mf.episodeNumber === episode)
  )

  const traceId = `TvShowPanel-unlinkEpisode-${nextTraceId()}`

  // Positive update: update UI first, then persist
  updateMediaMetadata(mediaMetadata.mediaFolderPath, {
    ...mediaMetadata,
    mediaFiles: updatedMediaFiles,
  }, { traceId })
    .then(() => {
      toast.success(t('tvShowEpisodeTable.unlinkSuccess'))
    })
    .catch((error: unknown) => {
      console.error(`[${traceId}] Failed to unlink episode:`, error)
      toast.error(t('tvShowEpisodeTable.unlinkFailed'))
    })
}