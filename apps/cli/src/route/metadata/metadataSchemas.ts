import type {
  MediaFileMetadata,
  MovieMediaMetadata,
  TvShowMediaMetadata,
} from '@smm/types'
import { z } from 'zod'

export const metadataFolderTypeSchema = z.enum([
  'music-folder',
  'tvshow-folder',
  'movie-folder',
])

const mediaFileMetadataSchema: z.ZodType<MediaFileMetadata> = z.object({
  absolutePath: z.string().min(1),
  seasonNumber: z.number().int().optional(),
  episodeNumber: z.number().int().optional(),
  subtitleFilePaths: z.array(z.string()).optional(),
  audioFilePaths: z.array(z.string()).optional(),
})

export const metadataMediaFilesSchema: z.ZodType<MediaFileMetadata[]> = z.array(
  mediaFileMetadataSchema,
)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const tvShowMediaMetadataSchema: z.ZodType<TvShowMediaMetadata> = z.custom<TvShowMediaMetadata>(
  (val) => isPlainObject(val),
  { message: 'tvShow must be an object' },
)

export const movieMediaMetadataSchema: z.ZodType<MovieMediaMetadata> = z.custom<MovieMediaMetadata>(
  (val) => isPlainObject(val),
  { message: 'movie must be an object' },
)

export const metadataPatchFieldSchemas = {
  type: metadataFolderTypeSchema.optional(),
  mediaFiles: metadataMediaFilesSchema.optional(),
  tvShow: tvShowMediaMetadataSchema.optional(),
  movie: movieMediaMetadataSchema.optional(),
} as const
