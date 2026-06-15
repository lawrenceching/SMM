import { z } from 'zod'

export const RENAME_FOLDER = 'rename-folder' as const

export const RENAME_FOLDER_DESCRIPTION =
  'Rename a media folder in SMM. ' +
  'This tool accepts the source folder path and destination folder path. ' +
  'This tool should ONLY be used to rename FOLDER, NOT FILE. ' +
  'This tool will update media metadata accordingly.\n\n' +
  'Example: Rename folder "/path/to/old-folder" to "/path/to/new-folder".'

export const renameFolderInputSchema = z.object({
  from: z
    .string()
    .describe(
      'The current absolute path of the folder to rename (POSIX or Windows format)',
    ),
  to: z
    .string()
    .describe(
      'The new absolute path for the folder (POSIX or Windows format)',
    ),
})

export const renameFolderOutputSchema = z.object({
  renamed: z.boolean().describe('Whether the folder was successfully renamed'),
  from: z.string().describe('The source path after normalization'),
  to: z.string().describe('The destination path after normalization'),
  error: z.string().optional().describe('Error message if rename failed'),
})

export type RenameFolderInput = z.infer<typeof renameFolderInputSchema>
export type RenameFolderOutput = z.infer<typeof renameFolderOutputSchema>

export const RENAME_FOLDER_CANCELLED = 'User cancelled the operation'

export const RENAME_FOLDER_CONFIRMATION_TITLE = 'Rename folder'
