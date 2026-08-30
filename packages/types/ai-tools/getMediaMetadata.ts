import { z } from 'zod'

export const GET_MEDIA_METADATA = 'get-media-metadata' as const

export const GET_MEDIA_METADATA_DESCRIPTION =
  'Get cached media metadata for a media folder. Returns normalized TV show ' +
  'season/episode data and TMDB/TVDB movie information when available. ' +
  'Use list-files-in-media-folder for raw file paths; episode-to-file mappings ' +
  'are not included in this response.'

export const GET_MEDIA_METADATA_NOT_MANAGED =
  'Media folder not found. The folder path may not be correct or the folder is not managed by SMM'

export const GET_MEDIA_METADATA_UNRECOGNIZED =
  'SMM未识别本文件夹, 请提示用户从SMM界面中搜索并匹配媒体'

export const GET_MEDIA_METADATA_NOT_DIRECTORY = 'Path is not a directory'
export const GET_MEDIA_METADATA_FOLDER_NOT_FOUND = 'Folder not found'
export const GET_MEDIA_METADATA_NO_CACHE = 'No metadata cached for this folder'

export const getMediaMetadataInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      'The absolute path of the media folder (POSIX or Windows format)',
    ),
})

const seasonEpisodeSchema = z.object({
  seasonNumber: z.number(),
  seasonName: z.string(),
  episodes: z.array(
    z.object({
      seasonNumber: z.number(),
      episodeNumber: z.number(),
      episodeName: z.string(),
    }),
  ),
})

export const getMediaMetadataDataSchema = z.object({
  mediaFolderPath: z.string().describe('The path of the media folder'),
  type: z
    .enum(['tvshow-folder', 'movie-folder', 'music-folder'])
    .describe('The type of the media folder'),
  tvShow: z
    .union([
      z.object({
        source: z.enum(['TMDB', 'TVDB']),
        id: z.number(),
        name: z.string(),
        seasons: z.array(seasonEpisodeSchema),
      }),
      z.string(),
    ])
    .optional()
    .describe('Normalized TV show data or message if not recognized'),
  tmdbMovie: z
    .union([
      z.object({
        tmdbId: z.number(),
        title: z.string(),
        originalTitle: z.string(),
        overview: z.string(),
        releaseDate: z.string(),
        posterPath: z.string().nullable(),
      }),
      z.string(),
    ])
    .optional()
    .describe('TMDB movie data or message if not recognized'),
  tvdbMovie: z
    .union([
      z.object({
        tvdbId: z.number(),
        name: z.string(),
        database: z.enum(['TMDB', 'TVDB']),
      }),
      z.string(),
    ])
    .optional()
    .describe('TVDB movie data or message if not recognized'),
})

export const getMediaMetadataToolOutputSchema = getMediaMetadataDataSchema.extend({
  error: z.string().optional().describe('Error message when lookup failed'),
})

export type GetMediaMetadataInput = z.infer<typeof getMediaMetadataInputSchema>
export type GetMediaMetadataResponseData = z.infer<typeof getMediaMetadataDataSchema>
export type GetMediaMetadataToolOutput = z.infer<
  typeof getMediaMetadataToolOutputSchema
>

export interface GetMediaMetadataResponseTvShowEpisodeData {
  seasonNumber: number
  episodeNumber: number
  episodeName: string
}

export interface GetMediaMetadataResponseTvShowSeasonData {
  seasonNumber: number
  seasonName: string
  episodes: GetMediaMetadataResponseTvShowEpisodeData[]
}

export interface GetMediaMetadataResponseTvShowData {
  source: 'TMDB' | 'TVDB'
  id: number
  name: string
  seasons: GetMediaMetadataResponseTvShowSeasonData[]
}

export interface GetMediaMetadataResponseTmdbMovieData {
  tmdbId: number
  title: string
  originalTitle: string
  overview: string
  releaseDate: string
  posterPath: string | null
}

export interface GetMediaMetadataResponseTvdbMovieData {
  tvdbId: number
  name: string
  database: 'TMDB' | 'TVDB'
}
