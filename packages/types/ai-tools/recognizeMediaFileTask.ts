import { z } from 'zod'

export const BEGIN_RECOGNIZE_TASK = 'begin-recognize-task' as const
export const ADD_RECOGNIZED_MEDIA_FILE = 'add-recognized-media-file' as const
export const END_RECOGNIZE_TASK = 'end-recognize-task' as const

export const BEGIN_RECOGNIZE_TASK_DESCRIPTION =
  'Begin a recognition task for identifying media files. ' +
  'This tool creates a task that can be used to add media files for recognition. ' +
  `Use ${ADD_RECOGNIZED_MEDIA_FILE} to add files, then ${END_RECOGNIZE_TASK} to execute.`

export const ADD_RECOGNIZED_MEDIA_FILE_DESCRIPTION =
  'Add a recognized media file to a recognition task. ' +
  `This tool adds a single video file to an existing task created by ${BEGIN_RECOGNIZE_TASK}. ` +
  'Provide the task ID, season number, episode number, and file path.'

export const END_RECOGNIZE_TASK_DESCRIPTION =
  'End a recognition task and execute the recognition. ' +
  `This tool finalizes the task created by ${BEGIN_RECOGNIZE_TASK} and ` +
  'processes all added media files.'

export const beginRecognizeTaskInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      'The absolute path of the media folder, it can be POSIX format or Windows format',
    ),
})

export const addRecognizedMediaFileInputSchema = z.object({
  taskId: z.string().describe(`The task ID returned from ${BEGIN_RECOGNIZE_TASK}`),
  season: z.number().describe('The season number of the episode.'),
  episode: z.number().describe('The episode number.'),
  path: z
    .string()
    .describe('The absolute path of the media file (POSIX or Windows format).'),
})

export const endRecognizeTaskInputSchema = z.object({
  taskId: z.string().describe(`The task ID returned from ${BEGIN_RECOGNIZE_TASK}`),
})
