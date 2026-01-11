import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type MediaMetadata, type MediaFileMetadata, RenameRuleVariables, type RenameRule, type TMDBSeason } from "@core/types"
import { basename, extname, relative, join, dirname } from "@/lib/path"
import { Path } from "@core/path"
import { listFilesApi } from "@/api/listFiles"

// Local type definitions for buildTvShowEpisodesPropsFromMediaMetadata
interface File {
  path: string
  tag: "SUB" | "AUD" | "NFO" | "POSTER" | "VID"
  newPath: string
}

interface Episode {
  name: string
  seasonNumber: number
  episodeNumber: number
  thumbnail?: string
  videoFilePath?: File
  associatedFiles: File[]
}

interface Season {
  name: string
  seasonNumber: number
  episodes: Episode[]
}

interface TvShowEpisodesProps {
  seasons: Season[]
  isEditing: boolean
}
import { getTMDBImageUrl } from "@/api/tmdb"
import filenamify from 'filenamify';
import { downloadImageApi } from "@/api/downloadImage"
import { isError, ExistedFileError } from "@core/errors"
import pLimit from 'p-limit';
const limit = pLimit(1);


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const extensions = {
  audioTrackFileExtensions: ['.mka'],
  videoFileExtensions: [
    // Common video formats
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
    // MPEG formats
    '.mpg', '.mpeg', '.m2v', '.m1v',
    // QuickTime formats
    '.qt', '.3gp', '.3g2',
    // RealMedia formats
    '.rm', '.rmvb', '.ra',
    // Windows Media formats
    '.asf', '.wm',
    // Ogg formats
    '.ogv', '.ogm',
    // Other formats
    '.vob', '.divx', '.f4v', '.h264', '.mxf', '.svi', '.tp', '.trp', '.wtv',
    // Transport streams
    '.ts', '.m2ts', '.mts',
    // Additional formats
    '.swf', '.yuv', '.m4p', '.m4b', '.m4r'
  ],
  subtitleFileExtensions: [
    // Common subtitle formats
    '.srt', '.ass', '.ssa', '.vtt', '.sub', '.idx',
    // SAMI formats
    '.smi', '.sami',
    // Other subtitle formats
    '.lrc', '.sbv', '.ttml', '.dfxp', '.stl', '.usf', '.dks', '.jss', '.pjs',
    '.psb', '.rt', '.s2k', '.sbt', '.scc', '.cap', '.cdg', '.scr', '.xas',
    '.mpl', '.mks', '.sup', '.aqt', '.gsub', '.vsf', '.zeg', '.cif', '.cip',
    '.ets', '.itk', '.slt', '.ssf', '.tds', '.txt'
  ],
  imageFileExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg'],
  musicFileExtensions: ['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.ape', '.mka', '.wma', '.aac', '.m4a', '.ogg', '.wav', '.flac', '.ape']
}

export const videoFileExtensions = extensions.videoFileExtensions;
export const imageFileExtensions = extensions.imageFileExtensions;


/**
 * Find the associated files (subtitle, audio, nfo etc) of the video file
 * @param filePaths 
 * @param videoFilePath 
 */
export function findAssociatedFiles(mediaFolderPath: string, filePaths: string[], videoFilePath: string): File[] {

  const filename = basename(videoFilePath)!;
  const extension = extname(filename);
  const filenameWithoutExtension = filename.replace(extension, '');

  const findFiles = (extensions: string[], tag: "SUB" | "AUD" | "NFO" | "POSTER") => {
    const possibleFileNames = extensions.map(extension => `${filenameWithoutExtension}${extension}`);
    return filePaths.filter(filePath => {
      return extensions.some(extension => filePath.endsWith(extension));
    })
    .filter(paths => {
      const filename = basename(paths)!;
      return possibleFileNames.includes(filename);
    })
    .map(paths => {
      const file: File = {
        path: getRelativePath(paths, mediaFolderPath),
        tag: tag,
        newPath: 'N/A'
      }
      return file;
    })
  }

  const thumbnailFiles = findFiles(extensions.imageFileExtensions, "POSTER");
  const subtitleFiles = findFiles(extensions.subtitleFileExtensions, "SUB");
  const audioFiles = findFiles(extensions.audioTrackFileExtensions, "AUD");
  const nfoFiles = findFiles(['.nfo'], "NFO");

  return [...thumbnailFiles, ...subtitleFiles, ...audioFiles, ...nfoFiles];
}

/**
 * Convert absolute path to relative path (relative to media folder)
 */
function getRelativePath(absolutePath: string, mediaFolderPath: string | undefined): string {
  if (!mediaFolderPath) {
    return absolutePath;
  }
  try {
    return relative(mediaFolderPath, absolutePath);
  } catch (error) {
    // If relative path calculation fails, return the absolute path
    return absolutePath;
  }
}

/**
 * Build TvShowEpisodesProps from MediaMetadata
 */
export function buildTvShowEpisodesPropsFromMediaMetadata(
  mediaMetadata: MediaMetadata | null | undefined,
  renameRule: RenameRule | undefined
): TvShowEpisodesProps {
  if (!mediaMetadata) {
    return { seasons: [], isEditing: false };
  }

  if(!mediaMetadata.tmdbTvShow) {
    return { seasons: [], isEditing: false };
  }

  const mediaFolderPath = mediaMetadata.mediaFolderPath;
  const tmdbTvShow = mediaMetadata.tmdbTvShow;
  
  const props: TvShowEpisodesProps = {
    seasons: [],
    isEditing: false,
  }

  
  tmdbTvShow?.seasons.forEach((season) => {
    const episodes = season.episodes?.map((episode) => {

      const videoFilePath = mediaMetadata.mediaFiles?.find(file => file.seasonNumber === episode.season_number && file.episodeNumber === episode.episode_number)

      const episodeProps: Episode = {
        name: episode.name,
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        thumbnail: episode.still_path ? getTMDBImageUrl(episode.still_path, 'w300') ?? undefined : undefined,
        associatedFiles: [],
      };

      if(videoFilePath) {
        episodeProps.videoFilePath = {
          path: getRelativePath(videoFilePath.absolutePath, mediaFolderPath),
          tag: "VID",
          newPath: ''
        }
        episodeProps.associatedFiles = findAssociatedFiles(mediaFolderPath!, mediaMetadata.files ?? [], videoFilePath.absolutePath);
        if(renameRule) {
          episodeProps.videoFilePath.newPath = generateNameByRenameRule(mediaMetadata, renameRule, videoFilePath)
        }
      }

      return episodeProps;
    });
    props.seasons.push({
      name: season.name,
      seasonNumber: season.season_number,
      episodes: episodes ?? [],
    });
  });

  return props;
}


/**
 * Generates a name from a rename rule template.
 * Can be used for both file names and folder names.
 * 
 * @param mediaMetadata The media metadata containing TV show/movie information
 * @param renameRule The rename rule with template to use
 * @param mediaFileMetadata Optional media file metadata. If provided, all RenameRuleVariables are used.
 *                         If not provided, only MediaMetadata-only variables are used (TV_SHOW_NAME, TMDB_ID, RELEASE_YEAR).
 * @returns The generated name (sanitized with filenamify). For paths with '/', only the filename part is sanitized.
 */
export function generateNameByRenameRule(
  mediaMetadata: MediaMetadata,
  renameRule: RenameRule,
  mediaFileMetadata?: MediaFileMetadata,
): string {
  const variables: Record<string, string> = {}

  RenameRuleVariables.forEach(variable => {
    if(variable.type === "buildin" && !!variable.fn) {
      variables[variable.name] = variable.fn(mediaMetadata, mediaFileMetadata)
    } else {
      console.error(`Unsupported variable type: ${variable.type}`)
      return '';
    }
  })

  let generatedName = renameRule.template

  // Replace all occurrences of each variable in the template
  Object.keys(variables).forEach(key => {
    // Use global regex to replace all occurrences
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    generatedName = generatedName.replace(regex, variables[key])
  })

  // Handle paths with '/' separators (for file paths with season folders)
  const parts = generatedName.split('/')

  if(parts.length === 1) {
    return filenamify(generatedName)
  } else {
    const filename = parts[parts.length - 1]
    const validFilename = filenamify(filename)
    return [...parts.slice(0, -1), validFilename].join('/')
  }
}


/**
 * Check if a file exists by listing files in its directory
 * @param filePath The file path in POSIX format
 * @returns true if file exists, false otherwise
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const directoryPath = dirname(filePath)
    const fileName = basename(filePath)
    
    if (!fileName) {
      console.error(`[checkFileExists] Invalid file path: ${filePath}`)
      return false
    }

    // Get all files in the directory
    const response = await listFilesApi(Path.toPlatformPath(directoryPath), {
      onlyFiles: true,
    })

    if (!response.data?.items) {
      console.error(`[checkFileExists] Failed to get files from directory: ${directoryPath}`)
      return false
    }

    const files = response.data.items

    // Check if the filename exists in the file list (case-sensitive match)
    const fileExists = files.some((file) => {
      const fileBasename = basename(file)
      return fileBasename === fileName
    })

    return fileExists
  } catch (error) {
    console.error(`[checkFileExists] Error checking file existence for ${filePath}:`, error)
    // Return false on error to allow download to proceed (graceful degradation)
    return false
  }
}

export async function downloadThumbnail(mediaMetadata: MediaMetadata, mediaFileMetadata: MediaFileMetadata) {
  return await limit(() => _downloadThumbnail(mediaMetadata, mediaFileMetadata));
}

export async function _downloadThumbnail(mediaMetadata: MediaMetadata, mediaFileMetadata: MediaFileMetadata) {

  const seasonNumber = mediaFileMetadata.seasonNumber;
  const episodeNumber = mediaFileMetadata.episodeNumber;
  const episode = mediaMetadata.tmdbTvShow?.seasons.find(season => season.season_number === seasonNumber)?.episodes?.find(episode => episode.episode_number === episodeNumber);
  if(!episode) {
    return;
  }
  const thumbnailUrl = episode.still_path ? getTMDBImageUrl(episode.still_path, 'w780') ?? undefined : undefined;
  if(!thumbnailUrl) {
    console.error(`[downloadThumbnail] Failed to get thumbnail URL for episode ${seasonNumber} ${episodeNumber}`);
    return;
  }
  console.log(`[downloadThumbnail] Downloading thumbnail for media file: `, mediaFileMetadata.absolutePath);
  console.log(`[downloadThumbnail] Downloading thumbnail for episode ${seasonNumber} ${episodeNumber} from ${thumbnailUrl}`);

  const videoFileName = basename(mediaFileMetadata.absolutePath)!;
  const videoFileNameExt = extname(videoFileName);
  const videoFileNameWithoutExt = videoFileName.replace(videoFileNameExt, '');

  const thumbnailExt = thumbnailUrl?.split('.').pop();
  if(!thumbnailExt) {
    console.error(`[downloadThumbnail] Failed to get thumbnail extension from ${thumbnailUrl}`);
    return;
  }

  const thumbnailFileName = `${videoFileNameWithoutExt}.${thumbnailExt}`;
  const thumbnailFilePath = mediaFileMetadata.absolutePath.replace(videoFileName, thumbnailFileName);
  console.log(`[downloadThumbnail] Checking if thumbnail exists: ${thumbnailFilePath}`);

  const fileExists = await checkFileExists(thumbnailFilePath);
  if (fileExists) {
    console.log(`[downloadThumbnail] Thumbnail already exists, skipping download: ${thumbnailFilePath}`);
    return;
  }

  console.log(`[downloadThumbnail] Downloading thumbnail to ${thumbnailFilePath}`);
  const resp = await downloadImageApi(thumbnailUrl, thumbnailFilePath);
  if(resp.error) {
    if(isError(resp.error, ExistedFileError)) {
      console.log(`[downloadThumbnail] Thumbnail already exists: ${thumbnailFilePath}`);
    } else {
      console.error(`[downloadThumbnail] Failed to download thumbnail: ${resp.error}`);
    }
    return;
  }
}

/**
 * Find the season folder path for a given season number
 * @param mediaFolderPath The media folder path in POSIX format
 * @param seasonNumber The season number
 * @returns The season folder path in POSIX format, or null if not found
 */
async function findSeasonFolder(mediaFolderPath: string, seasonNumber: number): Promise<string | null> {
  const possibleFolderNames: string[] = []
  
  if (seasonNumber === 0) {
    possibleFolderNames.push('Specials')
  } else {
    // Try without padding (e.g., "Season 1")
    possibleFolderNames.push(`Season ${seasonNumber}`)
    // Try with 2-digit padding (e.g., "Season 01")
    possibleFolderNames.push(`Season ${seasonNumber.toString().padStart(2, '0')}`)
  }

  try {
    // Get all folders in the media folder
    const response = await listFilesApi(Path.toPlatformPath(mediaFolderPath), {
      onlyFolders: true,
    })

    if (!response.data?.items) {
      return null
    }

    const folders = response.data.items

    // Check each possible folder name
    for (const folderName of possibleFolderNames) {
      const matchingFolder = folders.find((folder) => {
        const folderBasename = basename(folder)
        return folderBasename === folderName
      })

      if (matchingFolder) {
        return matchingFolder
      }
    }

    return null
  } catch (error) {
    console.error(`[findSeasonFolder] Error finding season folder for season ${seasonNumber}:`, error)
    return null
  }
}

/**
 * Download season poster image
 * @param mediaMetadata The media metadata
 * @param season The TMDB season object
 */
export async function downloadSeasonPoster(
  mediaMetadata: MediaMetadata,
  season: TMDBSeason
): Promise<void> {
  console.log(`[downloadSeasonPoster] Starting download for season ${season.season_number}`)
  
  // Check if season has poster_path
  if (!season.poster_path) {
    console.log(`[downloadSeasonPoster] ⏭️ No poster found for season ${season.season_number}`)
    return
  }

  // Validate media folder path exists
  if (!mediaMetadata.mediaFolderPath) {
    console.error('[downloadSeasonPoster] mediaFolderPath is undefined')
    return
  }

  console.log(`[downloadSeasonPoster] Looking for season folder for season ${season.season_number} in ${mediaMetadata.mediaFolderPath}`)

  // Find the season folder
  const seasonFolderPath = await findSeasonFolder(mediaMetadata.mediaFolderPath, season.season_number)
  
  if (!seasonFolderPath) {
    console.log(`[downloadSeasonPoster] ⏭️ No folder found for season ${season.season_number}, skipping download`)
    return
  }

  console.log(`[downloadSeasonPoster] Found season folder: ${seasonFolderPath}`)

  try {
    // Get the season poster URL
    const posterUrl = getTMDBImageUrl(season.poster_path, 'original')
    if (!posterUrl) {
      console.error(`[downloadSeasonPoster] Failed to get poster URL for season ${season.season_number}`)
      return
    }

    // Extract file extension from URL
    const thumbnailExt = posterUrl.split('.').pop()
    if (!thumbnailExt) {
      console.error(`[downloadSeasonPoster] Failed to get extension from ${posterUrl}`)
      return
    }

    // Build filename: season{number}-poster.{extension} (e.g., season01-poster.jpg, season00-poster.jpg for Specials)
    const seasonNumberPadded = season.season_number.toString().padStart(2, '0')
    const seasonPosterFileName = `season${seasonNumberPadded}-poster.${thumbnailExt}`
    const seasonPosterPath = join(seasonFolderPath, seasonPosterFileName)

    console.log(`[downloadSeasonPoster] Checking if season poster exists: ${seasonPosterPath}`)

    const fileExists = await checkFileExists(seasonPosterPath)
    if (fileExists) {
      console.log(`[downloadSeasonPoster] Season poster already exists, skipping download: ${seasonPosterPath}`)
      return
    }

    console.log(`[downloadSeasonPoster] Downloading season poster for season ${season.season_number} to ${seasonPosterPath}`)

    // Download the image
    const resp = await downloadImageApi(posterUrl, seasonPosterPath)
    if (resp.error) {
      if (isError(resp.error, ExistedFileError)) {
        console.log(`[downloadSeasonPoster] Season poster already exists: ${seasonPosterPath}`)
      } else {
        console.error(`[downloadSeasonPoster] Failed to download season poster: ${resp.error}`)
      }
      return
    }

    console.log(`✅ Season poster downloaded to: ${seasonPosterPath}`)
  } catch (error) {
    console.error(`[downloadSeasonPoster] Error downloading season poster for season ${season.season_number}:`, error)
    // Don't throw - errors are handled internally
  }
}