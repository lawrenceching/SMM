import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type MediaMetadata, type MediaFileMetadata, RenameRuleVariables, type RenameRule } from "@core/types"
import type { TvShowEpisodesProps, Episode, File } from "@/components/tvshow-episodes"
import { basename, extname, relative } from "@/lib/path"
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


/**
 * Find the associated files (subtitle, audio, nfo etc) of the video file
 * @param filePaths 
 * @param videoFilePath 
 */
function findAssociatedFiles(mediaFolderPath: string, filePaths: string[], videoFilePath: string): File[] {

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