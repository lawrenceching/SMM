import type { Hono } from 'hono'
import type { CreateMetadataRequestBody, MediaMetadata } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataProblemJson } from './problemDetails'

const mediaMetadataSchema = z.custom<MediaMetadata>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value),
).and(
  z.object({
    mediaFolderPath: z.string(),
  }).passthrough(),
)

const createMetadataRequestSchema: z.ZodType<CreateMetadataRequestBody> = z.object({
  data: mediaMetadataSchema,
})

export function handleCreateMetadata(app: Hono): void {
  app.post('/api/create-metadata', async (c) => {
    try {
      const body = createMetadataRequestSchema.parse(await c.req.json())
      const metadata = await getCore().createMetadata(body.data)
      return c.json({ data: metadata }, 200)
    } catch (error) {
      return metadataProblemJson(c, error)
    }
  })
}
