import { Hono } from 'hono'
import type { DeleteMetadataRequestBody } from '@smm/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataProblemJson } from './problemDetails'

const deleteMetadataRequestSchema: z.ZodType<DeleteMetadataRequestBody> = z.object({
  path: z.string(),
})

export const deleteMetadataRoute = new Hono().post('/api/delete-metadata', async (c) => {
  try {
    const body = deleteMetadataRequestSchema.parse(await c.req.json())
    await getCore().deleteMetadata(body.path)
    return c.json({ data: true as const }, 200)
  } catch (error) {
    return metadataProblemJson(c, error)
  }
})
