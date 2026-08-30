import { z } from 'zod'

export const GET_MEDIA_FOLDERS = 'get-media-folders' as const

export const GET_MEDIA_FOLDERS_DESCRIPTION =
  'Get the list of media folders managed by SMM.'

export const getMediaFoldersInputSchema = z.object({})

export const getMediaFoldersDataSchema = z.object({
  folders: z
    .array(z.string())
    .describe('Array of media folder paths managed by SMM'),
})

export const getMediaFoldersOutputSchema = getMediaFoldersDataSchema.extend({
  error: z.string().optional(),
})

export type GetMediaFoldersInput = z.infer<typeof getMediaFoldersInputSchema>
export type GetMediaFoldersResponseData = z.infer<
  typeof getMediaFoldersDataSchema
>
export type GetMediaFoldersToolOutput = z.infer<
  typeof getMediaFoldersOutputSchema
>
