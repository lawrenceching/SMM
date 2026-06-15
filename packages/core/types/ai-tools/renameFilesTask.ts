import { z } from 'zod'

export const BEGIN_RENAME_FILES_TASK = 'begin-rename-files-task' as const
export const ADD_RENAME_FILE_TO_TASK = 'add-rename-file-to-task' as const
export const END_RENAME_FILES_TASK = 'end-rename-files-task' as const

export const BEGIN_RENAME_FILES_TASK_DESCRIPTION =
  'Begin a rename task V2 for batch renaming media files. ' +
  'This tool creates a task that can be used to add multiple files for renaming. ' +
  `Use ${ADD_RENAME_FILE_TO_TASK} to add files, then ${END_RENAME_FILES_TASK} to execute.`

export const ADD_RENAME_FILE_TO_TASK_DESCRIPTION =
  'Add a file to a rename task. ' +
  `This tool adds a single file to an existing task created by ${BEGIN_RENAME_FILES_TASK}. ` +
  'Provide the task ID, current file path, and new file path.'

export const END_RENAME_FILES_TASK_DESCRIPTION =
  'End a rename task and execute the batch rename operation. ' +
  `This tool finalizes the task created by ${BEGIN_RENAME_FILES_TASK} and ` +
  'executes all pending file renames.'

export const beginRenameFilesTaskInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      'The absolute path of the media folder, it can be POSIX format or Windows format',
    ),
})

export const addRenameFileToTaskInputSchema = z.object({
  taskId: z
    .string()
    .describe(`The task ID from ${BEGIN_RENAME_FILES_TASK}`),
  from: z
    .string()
    .describe(
      'Current absolute path of the video file to rename (POSIX or Windows format)',
    ),
  to: z
    .string()
    .describe('New absolute path for the file (POSIX or Windows format)'),
})

export const endRenameFilesTaskInputSchema = z.object({
  taskId: z
    .string()
    .describe(`The task ID from ${BEGIN_RENAME_FILES_TASK}`),
})

export type BeginRenameFilesTaskInput = z.infer<
  typeof beginRenameFilesTaskInputSchema
>
export type AddRenameFileToTaskInput = z.infer<
  typeof addRenameFileToTaskInputSchema
>
export type EndRenameFilesTaskInput = z.infer<
  typeof endRenameFilesTaskInputSchema
>
