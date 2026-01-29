import type { SeasonModel } from "./TvShowPanel";
import type { MediaMetadata, MediaFileMetadata, TMDBEpisode, TMDBTVShowDetails, TMDBSeason } from "@core/types";
import { extname, join } from "@/lib/path";
import { Path } from "@core/path";
import { findAssociatedFiles, requireFieldsNonUndefined, nextTraceId } from "@/lib/utils";
import type { FileProps } from "@/lib/types";
import { parseEpisodeNfo } from "@/lib/nfo";
import { readFile } from "@/api/readFile";
import { renameFiles as renameFilesApi } from "@/api/renameFiles";
import type { UpdatePlanStatus } from "@/api/updatePlan";
import type { RecognizeMediaFilePlan, RecognizedFile } from "@core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan";
import { toast } from "sonner";
import { listFiles } from "@/api/listFiles";

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
    const associatedFileExtension = extname(associatedFilePath)
    const videoRelativePath = videoFilePath.replace(mediaFolderPath + '/', '')
    const associatedRelativePath = videoRelativePath.replace(videoFileExtension, associatedFileExtension)
    return join(mediaFolderPath, associatedRelativePath)
}

export function buildFileProps(mm: MediaMetadata, seasonNumber: number, episodeNumber: number): FileProps[] {
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
        const associatedFileExtension = extname(file.path);
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
 * Apply a RecognizeMediaFilePlan to media metadata and persist via updateMediaMetadata.
 * Caller is responsible for validation and must pass a traceId so the event origin is visible (e.g. TvShowPanel-handleAiRecognizeConfirm-...).
 */
export function applyRecognizeMediaFilePlan(
    plan: RecognizeMediaFilePlan,
    mediaMetadata: MediaMetadata,
    updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void,
    options: { traceId: string }
): void {
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
    updateMediaMetadata(mediaMetadata.mediaFolderPath!, updatedMetadata, { traceId: options.traceId });
}

export function _buildMappingFromSeasonModels(seasons: SeasonModel[]): {seasonNumber: number, episodeNumber: number, videoFilePath: string}[] {
    const mapping: {seasonNumber: number, episodeNumber: number, videoFilePath: string}[] = [];

    for (const season of seasons) {
        for (const episode of season.episodes) {
            // Find the video file for this episode
            const videoFile = episode.files.find(file => file.type === "video");
            
            if (videoFile) {
                mapping.push({
                    seasonNumber: season.season.season_number,
                    episodeNumber: episode.episode.episode_number,
                    videoFilePath: videoFile.path,
                });
            }
        }
    }

    return mapping;
}

export async function recognizeEpisodes(
    seasons: SeasonModel[], 
    mediaMetadata: MediaMetadata, 
    updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void) {
    const mapping = _buildMappingFromSeasonModels(seasons);
    console.log(`[TvShowPanelUtils] recognized episodes:`, mapping);

    // Map the recognized episodes to MediaFileMetadata format
    const mediaFiles: MediaFileMetadata[] = mapping.map(item => ({
        absolutePath: item.videoFilePath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
    }));

    // Update mediaMetadata with the new mediaFiles
    const updatedMetadata: MediaMetadata = {
        ...mediaMetadata,
        mediaFiles: mediaFiles,
    };

    // Call updateMediaMetadata to persist the changes
    if (mediaMetadata.mediaFolderPath) {
        const traceId = `TvShowPanelUtils-recognizeEpisodes-${nextTraceId()}`
        updateMediaMetadata(mediaMetadata.mediaFolderPath, updatedMetadata, { traceId });
    } else {
        console.error(`[TvShowPanelUtils] mediaFolderPath is undefined, cannot update media metadata`);
    }
}

function createInitialTMDBSeason(seasonNumber: number): TMDBSeason {
    return {
        id: seasonNumber,
        name: '',
        overview: '',
        poster_path: null,
        season_number: seasonNumber,
        air_date: '',
        episode_count: 0,
        episodes: [],
    }
}

/**
 * Try to regcognize media folder by NFO. 
 * @param mediaFolderPath 
 * @param signal optional AbortSignal to cancel the operation
 * @returns return undefined if not recognizable
 */
export async function tryToRecognizeMediaFolderByNFO(_mm: MediaMetadata, signal?: AbortSignal): Promise<MediaMetadata | undefined> {

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
    
    const tvshowDetails = buildTmdbTVShowDetailsByNFO(resp.data)
    mm.tmdbTvShow = tvshowDetails

    const episodeNfoFiles = mm.files.filter(file => file.endsWith('.nfo') && !file.endsWith('/tvshow.nfo'))
    if(episodeNfoFiles.length === 0) {
        console.log(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: no episode NFO files found`)
        return undefined
    }

    
    for(const episodeNfoFile of episodeNfoFiles) {
        if (signal?.aborted) {
            return undefined
        }
        const resp = await readFile(episodeNfoFile, signal)
        if(resp.error) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to read episode NFO file: ${episodeNfoFile}`, resp.error)
            continue
        }
        if(resp.data === undefined) {
            console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unexpected response body: no data`, resp)
            continue
        }
        const xml = resp.data
        const episodeNfo = await parseEpisodeNfo(xml)
        
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

        if(mm.tmdbTvShow !== undefined) {
            const { season } = episodeNfo
            
            let tmdbSeason = mm.tmdbTvShow.seasons.find(_season => _season.season_number === season)
            if(tmdbSeason === undefined) {
                tmdbSeason = createInitialTMDBSeason(season!)
                mm.tmdbTvShow.seasons.push(tmdbSeason)
            }

            if(tmdbSeason.episodes === undefined) {
                tmdbSeason.episodes = []
            }

            const tmdbEpisode = buildTmdbEpisodeByNFO(xml)
            if(tmdbEpisode === undefined) {
                console.error(`[TvShowPanelUtils] tryToRecognizeMediaFolderByNFO: unable to build tmdbEpisode from NFO file: ${episodeNfoFile}`)
                continue
            }
            tmdbSeason.episodes.push(tmdbEpisode)

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
 * Build SeasonModel[] from a RecognizeMediaFilePlan for preview/display.
 * Groups plan.files by season, resolves TMDB season/episode from mm.tmdbTvShow when present,
 * and builds FileProps (video + associated files) per episode using the plan's paths.
 */
export function buildSeasonsByRecognizeMediaFilePlan(mm: MediaMetadata, plan: RecognizeMediaFilePlan): SeasonModel[] {


  const mediaFolderPath = plan.mediaFolderPath ?? mm.mediaFolderPath
  const fileList = mm.files ?? []

  if (!plan.files?.length) {
    return []
  }

  // Group by season number, then by episode number for stable ordering
  const bySeason = new Map<number, { season: number; episode: number; path: string }[]>()
  for (const f of plan.files) {
    const list = bySeason.get(f.season) ?? []
    list.push({ season: f.season, episode: f.episode, path: f.path })
    bySeason.set(f.season, list)
  }

  const seasonNumbers = Array.from(bySeason.keys()).sort((a, b) => a - b)
  const result: SeasonModel[] = []

  for (const seasonNumber of seasonNumbers) {
    const entries = bySeason.get(seasonNumber)!
    entries.sort((a, b) => a.episode - b.episode)

    const tmdbSeason =
      mm.tmdbTvShow?.seasons?.find((s) => s.season_number === seasonNumber) ??
      createInitialTMDBSeason(seasonNumber)

    const episodes = entries.map(({ episode: episodeNumber, path: videoPath }) => {
      const tmdbEpisode =
        tmdbSeason.episodes?.find((e) => e.episode_number === episodeNumber) ?? ({
          id: 0,
          name: "",
          overview: "",
          still_path: null,
          air_date: "",
          episode_number: episodeNumber,
          season_number: seasonNumber,
          vote_average: 0,
          vote_count: 0,
          runtime: 0,
        } as TMDBEpisode)

      const files: FileProps[] =
        mediaFolderPath && fileList.length > 0
          ? [
              { type: "video", path: videoPath },
              ...findAssociatedFiles(mediaFolderPath, fileList, videoPath).map((file) => ({
                type: mapTagToFileType(file.tag),
                path: join(mediaFolderPath, file.path),
              })),
            ]
          : [{ type: "video", path: videoPath }]

      return { episode: tmdbEpisode, files }
    })

    result.push({ season: tmdbSeason, episodes })
  }

  return result
}

/**
 * Build SeasonModel[] from a RenameFilesPlan for preview/display.
 * Resolves season/episode from mm.mediaFiles by matching "from" path.
 * Only includes entries whose "from" exists in mm.files (source file must exist).
 * FileProps use path = source path, newPath = destination path ("to" from the plan).
 */
export function buildSeasonsByRenameFilesPlan(mm: MediaMetadata, plan: RenameFilesPlan): SeasonModel[] {
  const mediaFolderPath = plan.mediaFolderPath ?? mm.mediaFolderPath
  const fileList = mm.files ?? []
  const mediaFiles = mm.mediaFiles ?? []

  if (!plan.files?.length || !mediaFolderPath) {
    return []
  }

  const filesSet = new Set(fileList)

  const bySeasonEpisode = new Map<string, { season: number; episode: number; from: string; to: string }>()
  for (const { from, to } of plan.files) {
    if (!filesSet.has(from)) continue
    const mf = mediaFiles.find((x) => x.absolutePath === from)
    if (!mf || mf.seasonNumber === undefined || mf.episodeNumber === undefined) continue
    const key = `${mf.seasonNumber}:${mf.episodeNumber}`
    if (!bySeasonEpisode.has(key)) {
      bySeasonEpisode.set(key, {
        season: mf.seasonNumber,
        episode: mf.episodeNumber,
        from,
        to,
      })
    }
  }

  const keys = Array.from(bySeasonEpisode.keys()).sort((a, b) => {
    const [s1, e1] = a.split(":").map(Number)
    const [s2, e2] = b.split(":").map(Number)
    return s1 !== s2 ? s1 - s2 : e1 - e2
  })

  const result: SeasonModel[] = []
  let lastSeason = -1
  let currentSeasonModel: SeasonModel | null = null

  for (const key of keys) {
    const entry = bySeasonEpisode.get(key)!
    const { season: seasonNumber, episode: episodeNumber, from, to } = entry

    const tmdbSeason =
      mm.tmdbTvShow?.seasons?.find((s) => s.season_number === seasonNumber) ??
      createInitialTMDBSeason(seasonNumber)

    const tmdbEpisode =
      tmdbSeason.episodes?.find((e) => e.episode_number === episodeNumber) ?? ({
        id: 0,
        name: "",
        overview: "",
        still_path: null,
        air_date: "",
        episode_number: episodeNumber,
        season_number: seasonNumber,
        vote_average: 0,
        vote_count: 0,
        runtime: 0,
      } as TMDBEpisode)

    const videoFileProps: FileProps =
      { type: "video", path: from, newPath: to }

    const associated = findAssociatedFiles(mediaFolderPath, fileList, from)
    const associatedFileProps: FileProps[] = associated.map((file) => {
      const currentPath = join(mediaFolderPath, file.path)
      return {
        type: mapTagToFileType(file.tag),
        path: currentPath,
        newPath: newPath(mediaFolderPath, to, currentPath),
      }
    })

    const files: FileProps[] =
      fileList.length > 0 ? [videoFileProps, ...associatedFileProps] : [videoFileProps]

    const episodeModel = { episode: tmdbEpisode, files }

    if (seasonNumber !== lastSeason) {
      currentSeasonModel = { season: tmdbSeason, episodes: [] }
      result.push(currentSeasonModel)
      lastSeason = seasonNumber
    }
    currentSeasonModel!.episodes.push(episodeModel)
  }

  return result
}

export async function executeRenamePlan(
  plan: RenameFilesPlan,
  mediaMetadata: MediaMetadata,
  updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void,
  updatePlan: (planId: string, status: UpdatePlanStatus) => Promise<void>,
  fetchPendingPlans: () => Promise<void>
): Promise<void> {
  if (!mediaMetadata || plan.mediaFolderPath !== mediaMetadata.mediaFolderPath) {
    toast.error("Plan does not match current media folder")
    return
  }
  const seasonsFromPlan = buildSeasonsByRenameFilesPlan(mediaMetadata, plan)
  const traceId = `TvShowPanel-executeRenamePlan-${nextTraceId()}`

  const filesToRename: Array<{ from: string; to: string }> = []

  for (const season of seasonsFromPlan) {
    for (const episode of season.episodes) {
      for (const file of episode.files) {
        if (file.newPath && file.path !== file.newPath) {
          filesToRename.push({
            from: file.path,
            to: file.newPath,
          })
        }
      }
    }
  }

  if (filesToRename.length === 0) {
    toast.info("No files to rename")
    await updatePlan(plan.id, "completed")
    await fetchPendingPlans()
    return
  }

  try {
    const response = await renameFilesApi({
      files: filesToRename,
      traceId,
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

    let updatedMediaFiles = mediaMetadata.mediaFiles ?? []
    const succeededPathsSet = new Set(succeededPaths)

    updatedMediaFiles = updatedMediaFiles.map((mediaFile) => {
      if (succeededPathsSet.has(mediaFile.absolutePath)) {
        const renameEntry = filesToRename.find((entry) => entry.from === mediaFile.absolutePath)
        if (renameEntry) {
          return {
            ...mediaFile,
            absolutePath: renameEntry.to,
          }
        }
      }
      return mediaFile
    })

    // List latest files after rename operation
    const latestFilesResp = await listFiles({
      path: mediaMetadata.mediaFolderPath,
      recursively: true,
      onlyFiles: true,
    })

    if (latestFilesResp.error) {
      console.error(`[executeRenamePlan] Failed to list files: ${latestFilesResp.error}`)
      toast.error(`Failed to refresh file list: ${latestFilesResp.error}`)
      return
    }

    if (latestFilesResp.data === undefined) {
      console.error(`[executeRenamePlan] Unexpected response: no data`)
      toast.error(`Failed to refresh file list: no data received`)
      return
    }

    // Handle both old format (strings) and new format (objects with path property)
    // and convert to POSIX paths
    const latestFiles = latestFilesResp.data.items
      .map((i: { path?: string } | string) => {
        const path = typeof i === 'string' ? i : (i.path ?? '');
        return Path.posix(path);
      })
      .filter((path: string) => path !== '');

    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      files: latestFiles,
      mediaFiles: updatedMediaFiles,
    }, { traceId })

    const successCount = succeededPaths.length
    const errorCount = failedPaths.length

    if (errorCount === 0) {
      toast.success(`Successfully renamed ${successCount} file(s)`)
    } else {
      toast.warning(`Renamed ${successCount} file(s), ${errorCount} failed`)
    }

    await updatePlan(plan.id, "completed")
    await fetchPendingPlans()
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
export function buildTemporaryRecognitionPlan(
  mediaMetadata: MediaMetadata,
  lookup: (files: string[], seasonNumber: number, episodeNumber: number) => string | null
): Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] } | null {
  if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files || !mediaMetadata.tmdbTvShow) {
    return null
  }

  const files: RecognizedFile[] = []

  // Iterate through all seasons and episodes to build the file mappings
  mediaMetadata.tmdbTvShow.seasons.forEach(season => {
    season.episodes?.forEach(episode => {
      // Always use lookup utility to find the file based on filename patterns
      // Don't use existing mediaMetadata.mediaFiles as they may be incorrect
      const videoFilePath = lookup(mediaMetadata.files || [], season.season_number, episode.episode_number)
      if (videoFilePath) {
        files.push({
          season: season.season_number,
          episode: episode.episode_number,
          path: videoFilePath
        })
      }
    })
  })

  if (files.length === 0) {
    return null
  }

  console.log('[buildTemporaryRecognitionPlan]', {
    files,
    mediaFolderPath: mediaMetadata.mediaFolderPath
  })

  return {
    mediaFolderPath: mediaMetadata.mediaFolderPath,
    files
  }
}

/**
 * Build SeasonModel[] from mediaMetadata.tmdbTvShow
 * This creates a new seasons model with all episodes from tmdbTvShow, initialized with empty files array.
 *
 * @param mediaMetadata - The media metadata containing tmdbTvShow
 * @returns SeasonModel array with episodes from tmdbTvShow, or null if tmdbTvShow is undefined
 */
export function buildSeasonsModelFromMediaMetadata(mediaMetadata: MediaMetadata): SeasonModel[] | null {
  if (!mediaMetadata.tmdbTvShow) {
    return null
  }

  const seasons: SeasonModel[] = []

  for (const tmdbSeason of mediaMetadata.tmdbTvShow.seasons || []) {
    const episodes: Array<{ episode: TMDBEpisode; files: FileProps[] }> = []

    for (const tmdbEpisode of tmdbSeason.episodes || []) {
      episodes.push({
        episode: tmdbEpisode,
        files: [], // Initialize with empty files array
      })
    }

    seasons.push({
      season: tmdbSeason,
      episodes,
    })
  }

  return seasons
}

/**
 * Recognize media files by rules and update season models for preview.
 * This function builds a new seasons model from tmdbTvShow and populates episode files
 * by using the lookup function to find video files for episodes that don't have mediaFiles assigned.
 *
 * @param mediaMetadata - The media metadata containing files and TV show info
 * @param lookup - Function to lookup files based on season/episode numbers
 * @returns Updated season models with recognized files, or null if mediaMetadata is invalid
 */
export function recognizeMediaFilesByRules(
  mediaMetadata: MediaMetadata,
  lookup: (files: string[], seasonNumber: number, episodeNumber: number) => string | null
): SeasonModel[] | null {
  if (!mediaMetadata) {
    return null
  }

  if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files) {
    return null
  }

  try {
    // Build initial seasons model from tmdbTvShow
    const seasonsForPreview = buildSeasonsModelFromMediaMetadata(mediaMetadata)
    if (!seasonsForPreview) {
      return null
    }

    console.log(`[TvShowPanelUtils] built seasons model from tmdbTvShow:`, seasonsForPreview)

    const updateSeasonsForPreview = (seasonNumber: number, episodeNumber: number, videoFilePath: string) => {
      // Find the matching season and episode
      const season = seasonsForPreview.find(s => s.season.season_number === seasonNumber)
      if (!season) {
        return
      }

      const episode = season.episodes.find(ep => ep.episode.episode_number === episodeNumber)
      if (!episode) {
        return
      }

      // Check that mediaMetadata has required properties
      if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files) {
        return
      }

      // Find associated files (subtitles, audio, nfo, poster)
      const associatedFiles = findAssociatedFiles(mediaMetadata.mediaFolderPath, mediaMetadata.files, videoFilePath)

      // Build the new files array
      const newFiles: FileProps[] = [
        {
          type: "video",
          path: videoFilePath,
        },
        ...associatedFiles.map(file => ({
          type: mapTagToFileType(file.tag),
          // Convert relative path to absolute path
          path: join(mediaMetadata.mediaFolderPath!, file.path),
        }))
      ]

      // Update the episode's files
      console.log(`[TvShowPanelUtils] updating episode files:`, episode.files, newFiles)
      episode.files = newFiles
    }

    mediaMetadata.tmdbTvShow?.seasons.forEach(season => {
      season.episodes?.forEach(episode => {
        // Always use lookup for rule-based recognition to get fresh recognition results
        // This handles cases where mediaFiles may be outdated or incorrect
        const videoFilePath = lookup(mediaMetadata.files!, season.season_number, episode.episode_number)
        console.log(`[TvShowPanelUtils] video file path from lookup:`, videoFilePath)

        if (videoFilePath !== null) {
          updateSeasonsForPreview(season.season_number, episode.episode_number, videoFilePath)
        }
      })
    })

    console.log(`[TvShowPanelUtils] seasons for preview:`, seasonsForPreview)
    return seasonsForPreview
  } catch (error) {
    console.error('[TvShowPanelUtils] Error building seasons state from media metadata', error)
    return null
  }
}
