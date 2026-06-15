import { z } from 'zod'

export const IS_FOLDER_EXIST = 'is-folder-exist' as const

export const IS_FOLDER_EXIST_DESCRIPTION =
  'Check if a folder exists in the file system. ' +
  'Returns `{ exists, path, reason? }` where `exists` is true when ' +
  'the path is an existing directory.'

export const IS_FOLDER_EXIST_INVALID_PATH =
  'Invalid path: path must be a non-empty string'

export const IS_FOLDER_EXIST_NOT_DIRECTORY =
  'Path exists but is not a directory'

export const IS_FOLDER_EXIST_NOT_FOUND = 'Path does not exist'

export const isFolderExistInputSchema = z.object({
  path: z
    .string()
    .describe(
      'The absolute path of the folder to check (POSIX or Windows format)',
    ),
})

export const isFolderExistOutputSchema = z.object({
  exists: z.boolean().describe('Whether the folder exists'),
  path: z.string().describe('The normalized path that was checked'),
  reason: z
    .string()
    .optional()
    .describe('Reason for non-existence or non-directory'),
})

export type IsFolderExistInput = z.infer<typeof isFolderExistInputSchema>
export type IsFolderExistOutput = z.infer<typeof isFolderExistOutputSchema>
