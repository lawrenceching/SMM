import type { Hono } from 'hono'
import type { GetMetadataRequestBody } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataProblemJson } from './problemDetails'

const getMetadataRequestSchema: z.ZodType<GetMetadataRequestBody> = z.object({
  path: z.string(),
})

export function handleGetMetadata(app: Hono): void {
  app.post('/api/get-metadata', async (c) => {
    try {
      const body = getMetadataRequestSchema.parse(await c.req.json())
      const metadata = await getCore().getMetadata(body.path)
      return c.json({ data: metadata }, 200)
    } catch (error) {
      return metadataProblemJson(c, error)
    }
  })
}
