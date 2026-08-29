import type { Hono } from 'hono'
import type { CreateMetadataRequestBody } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataPatchFieldSchemas } from './metadataSchemas'
import { metadataProblemJson } from './problemDetails'

const createMetadataDataSchema = z.object({
  mediaFolderPath: z.string().min(1),
  ...metadataPatchFieldSchemas,
}).passthrough()

const createMetadataRequestSchema: z.ZodType<CreateMetadataRequestBody> = z.object({
  data: createMetadataDataSchema,
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
