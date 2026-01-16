import type { SeasonModel } from "./TvShowPanel";
import type { MediaMetadata, MediaFileMetadata } from "@core/types";
import { extname, join } from "@/lib/path";
import { findAssociatedFiles } from "@/lib/utils";
import type { FileProps } from "@/lib/types";

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
    updateMediaMetadata: (path: string, metadata: MediaMetadata) => void) {
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
        updateMediaMetadata(mediaMetadata.mediaFolderPath, updatedMetadata);
    } else {
        console.error(`[TvShowPanelUtils] mediaFolderPath is undefined, cannot update media metadata`);
    }
}