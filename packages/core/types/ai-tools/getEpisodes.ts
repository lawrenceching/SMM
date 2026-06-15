import { z } from 'zod'

export const GET_EPISODES = 'get-episodes' as const

export const GET_EPISODES_DESCRIPTION =
  'Get all episodes for a TV show with their video file paths. ' +
  'Combines TMDB or TVDB episode data (from cached metadata) with local media file paths. ' +
  'For each episode, returns season, episode number, and video file path. ' +
  'The video file path may be undefined if the episode has not been recognized yet.'

export const GET_EPISODES_INVALID_PATH =
  "Invalid path: 'mediaFolderPath' must be a non-empty string"

export const GET_EPISODES_NOT_MANAGED =
  'Media folder not found. The folder path may not be correct or the folder is not managed by SMM'

export const GET_EPISODES_NO_CACHE =
  'TV show not found. Please ensure the media folder is opened in SMM.'

export const GET_EPISODES_NOT_TV_SHOW =
  'Not a TV show folder. This tool only works with TV show media folders that have TMDB or TVDB metadata cached.'

export const getEpisodesInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      'The absolute path of the TV show media folder (POSIX or Windows format)',
    ),
})

export const getEpisodesEpisodeSchema = z.object({
  season: z.number().describe('The season number'),
  episode: z.number().describe('The episode number'),
  videoFilePath: z
    .string()
    .optional()
    .describe(
      'The absolute path of the video file, undefined if not recognized yet',
    ),
})

export const getEpisodesDataSchema = z.object({
  episodes: z
    .array(getEpisodesEpisodeSchema)
    .describe('Array of all episodes with their video file paths'),
  totalCount: z.number().describe('Total number of episodes'),
  showName: z.string().describe('The name of the TV show'),
  numberOfSeasons: z.number().describe('Number of seasons in the show'),
})

export const getEpisodesToolOutputSchema = getEpisodesDataSchema.extend({
  error: z.string().optional(),
})

export type GetEpisodesInput = z.infer<typeof getEpisodesInputSchema>
export type GetEpisodesEpisode = z.infer<typeof getEpisodesEpisodeSchema>
export type GetEpisodesResponseData = z.infer<typeof getEpisodesDataSchema>
export type GetEpisodesToolOutput = z.infer<typeof getEpisodesToolOutputSchema>
