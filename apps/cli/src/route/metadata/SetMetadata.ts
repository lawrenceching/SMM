import type { Hono } from 'hono'
import type { MediaMetadata, SetMetadataRequestBody } from '@core/types'
import { z } from 'zod'
import { getCore } from '../../core/getCore'
import { metadataProblemJson } from './problemDetails'

const metadataPatchSchema: z.ZodType<SetMetadataRequestBody['patch']> = z.object({
  type: z.custom<MediaMetadata['type']>().optional(),
  mediaFiles: z.custom<MediaMetadata['mediaFiles']>().optional(),
  tvShow: z.custom<MediaMetadata['tvShow']>().optional(),
  movie: z.custom<MediaMetadata['movie']>().optional(),
}).strict()

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
