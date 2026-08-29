import { z } from 'zod'

export const RENAME_EPISODE_FILE = 'rename-episode-file' as const

export const RENAME_EPISODE_FILE_DESCRIPTION =
  'Rename a linked TV episode video file (and same-stem associates such as subtitles) in a managed TV show folder. ' +
  'Use ONLY for a single episode file that already has seasonNumber and episodeNumber in media metadata. ' +
  'Do NOT use for folders (use rename-folder), movies, orphan files, or bulk renames ' +
  '(use create-rename-episode-plan for multi-file plans).\n\n' +
  'Example: Rename episode file in folder "/path/to/show" from ".../S01E01.mp4" to ".../S01E01_renamed.mp4".'

export const renameEpisodeFileInputSchema = z.object({
  mediaFolder: z
    .string()
    .describe(
      'Absolute path of the managed TV show media folder (POSIX or Windows format)',
    ),
  from: z
    .string()
    .describe(
      'Absolute current path of the linked episode video file (POSIX or Windows format)',
    ),
  to: z
    .string()
    .describe(
      'Absolute target path for the episode video file under the same media folder (POSIX or Windows format)',
    ),
})

export const renameEpisodeFileOutputSchema = z.object({
  renamed: z
    .boolean()
    .describe('True when at least one file was renamed successfully'),
  mediaFolder: z.string().describe('The media folder path after normalization'),
  from: z.string().describe('The primary source episode path after normalization'),
  to: z.string().describe('The primary destination episode path after normalization'),
  succeeded: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
      }),
    )
    .describe('Successful rename pairs (episode + associates)'),
  failed: z
    .array(
      z.object({
        path: z.string(),
        error: z.string(),
      }),
    )
    .describe('Per-path failures'),
  error: z.string().optional().describe('Error or cancellation message when rename did not fully succeed'),
})

export type RenameEpisodeFileInput = z.infer<typeof renameEpisodeFileInputSchema>
export type RenameEpisodeFileOutput = z.infer<typeof renameEpisodeFileOutputSchema>

export const RENAME_EPISODE_FILE_CANCELLED = 'User cancelled the operation'

export const RENAME_EPISODE_FILE_CONFIRMATION_TITLE = 'Rename episode file'
