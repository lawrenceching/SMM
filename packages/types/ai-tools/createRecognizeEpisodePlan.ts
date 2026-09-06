import { z } from 'zod'

export const CREATE_RECOGNIZE_EPISODE_PLAN = 'create-recognize-episode-plan' as const

export const CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION =
  'Create a recognize-media-file plan that maps episode video files to season/episode numbers. ' +
  'Provide every mapping (season, episode, absolute file path) in one call. ' +
  'After success, tell the user to open SMM, review, and approve the plan.'

export const createRecognizeEpisodePlanInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe('Absolute media folder path (POSIX or Windows)'),
  files: z
    .array(
      z.object({
        season: z.number().describe('The season number of the episode.'),
        episode: z.number().describe('The episode number.'),
        path: z
          .string()
          .describe('The absolute path of the media file (POSIX or Windows format).'),
      }),
    )
    .min(1),
})

export type CreateRecognizeEpisodePlanInput = z.infer<
  typeof createRecognizeEpisodePlanInputSchema
>
