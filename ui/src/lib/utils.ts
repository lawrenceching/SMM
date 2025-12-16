import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { MediaMetadata, MediaFileMetadata, TMDBEpisode } from "@core/types"
import type { TvShowEpisodesProps, Episode, File, Season } from "@/components/tvshow-episodes"
import { relative } from "@/lib/path"
import { getTMDBImageUrl } from "@/api/tmdb"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
      return {
        name: episode.name,
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        thumbnail: episode.still_path ? getTMDBImageUrl(episode.still_path, 'w300') : undefined,
      } as Episode;
    });
    props.seasons.push({
      name: season.name,
      seasonNumber: season.season_number,
      episodes: episodes ?? [],
    });
  });

  return props;
}