import { z } from 'zod'

export const LIST_FILES_IN_MEDIA_FOLDER = 'list-files-in-media-folder' as const

export const LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION =
  'List files in a media folder by scanning the file system recursively. ' +
  'Returns file paths in OS-native format. Use videoFileOnly to restrict to video files.'

export const LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH =
  "Invalid path: 'mediaFolderPath' must be a non-empty string"

export const LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED =
  'Media folder not found. The folder path may not be correct or the folder is not managed by SMM'

export const listFilesInMediaFolderInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      'The absolute path of the media folder (POSIX or Windows format)',
    ),
  recursively: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to list files recursively (default: true)'),
  videoFileOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to return only video files (default: false)'),
})

export const listFilesInMediaFolderDataSchema = z.object({
  files: z.array(z.string()).describe('Array of file paths'),
  count: z.number().describe('Number of files listed'),
})

export const listFilesInMediaFolderOutputSchema =
  listFilesInMediaFolderDataSchema.extend({
    error: z.string().optional(),
  })

export type ListFilesInMediaFolderInput = z.infer<
  typeof listFilesInMediaFolderInputSchema
>
export type ListFilesInMediaFolderResponseData = z.infer<
  typeof listFilesInMediaFolderDataSchema
>
export type ListFilesInMediaFolderToolOutput = z.infer<
  typeof listFilesInMediaFolderOutputSchema
>
