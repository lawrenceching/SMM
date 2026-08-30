import type { Hono } from 'hono'
import type { SetMetadataRequestBody } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataPatchFieldSchemas } from './metadataSchemas'
import { metadataProblemJson } from './problemDetails'

const metadataPatchSchema: z.ZodType<SetMetadataRequestBody['patch']> = z.object(
  metadataPatchFieldSchemas,
).strict()

const setMetadataRequestSchema: z.ZodType<SetMetadataRequestBody> = z.object({
  path: z.string(),
  patch: metadataPatchSchema,
})

export function handleSetMetadata(app: Hono): void {
  app.post('/api/set-metadata', async (c) => {
    try {
      const body = setMetadataRequestSchema.parse(await c.req.json())
      const metadata = await getCore().setMetadata(body.path, body.patch)
      return c.json({ data: metadata }, 200)
    } catch (error) {
      return metadataProblemJson(c, error)
    }
  })
}
