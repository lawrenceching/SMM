import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { MediaMetadata, MediaFileMetadata, TMDBEpisode } from "@core/types"
import type { TvShowEpisodesProps, Episode, File, Season } from "@/components/tvshow-episodes"
import { basename, extname, relative } from "@/lib/path"
import { getTMDBImageUrl } from "@/api/tmdb"


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
        newPath: ''
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
  mediaMetadata: MediaMetadata | null | undefined
): TvShowEpisodesProps {
  if (!mediaMetadata) {
    return { seasons: [] };
  }

  if(!mediaMetadata.tmdbTvShow) {
    return { seasons: [] };
  }

  const mediaFolderPath = mediaMetadata.mediaFolderPath;
  const tmdbTvShow = mediaMetadata.tmdbTvShow;
  const hasMediaFiles = mediaMetadata.mediaFiles && mediaMetadata.mediaFiles.length > 0;
  
  const props: TvShowEpisodesProps = {
    seasons: [],
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