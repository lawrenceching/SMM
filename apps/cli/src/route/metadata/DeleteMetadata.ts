import type { Hono } from 'hono'
import type { DeleteMetadataRequestBody } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataProblemJson } from './problemDetails'

const deleteMetadataRequestSchema: z.ZodType<DeleteMetadataRequestBody> = z.object({
  path: z.string(),
})

export function handleDeleteMetadata(app: Hono): void {
  app.post('/api/delete-metadata', async (c) => {
    try {
      const body = deleteMetadataRequestSchema.parse(await c.req.json())
      await getCore().deleteMetadata(body.path)
      return c.json({ data: true }, 200)
    } catch (error) {
      return metadataProblemJson(c, error)
    }
  })
}
