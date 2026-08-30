import { z } from 'zod'

export const CREATE_RENAME_EPISODE_PLAN = 'create-rename-episode-plan' as const

export const CREATE_RENAME_EPISODE_PLAN_DESCRIPTION =
  'Create a rename-files plan for TV episode video files with explicit from/to paths. ' +
  'After success, tell the user to open SMM, review, and approve the plan.'

export const createRenameEpisodePlanInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe('Absolute media folder path (POSIX or Windows)'),
  files: z
    .array(
      z.object({
        from: z.string().describe('Current absolute video path'),
        to: z.string().describe('New absolute video path'),
      }),
    )
    .min(1),
})

export type CreateRenameEpisodePlanInput = z.infer<
  typeof createRenameEpisodePlanInputSchema
>
