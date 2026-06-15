import { z } from 'zod'

export const GET_APPLICATION_CONTEXT = 'get-app-context' as const

export const GET_APPLICATION_CONTEXT_DESCRIPTION =
  'Get SMM context:\n' +
  '  * The media folder user selected/focused on SMM UI\n' +
  '  * The language in user preferences'

export const getApplicationContextInputSchema = z.object({})

export const getApplicationContextOutputSchema = z.object({
  selectedMediaFolder: z
    .string()
    .describe('The path of the media folder that user selected in UI.'),
  language: z
    .string()
    .describe('The language in user preferences.'),
  error: z
    .string()
    .optional()
    .describe('Error message if the operation failed'),
})

export type GetApplicationContextInput = z.infer<
  typeof getApplicationContextInputSchema
>
export type GetApplicationContextOutput = z.infer<
  typeof getApplicationContextOutputSchema
>
