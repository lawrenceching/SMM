import { z } from 'zod'

export const metadataFolderTypeSchema = z.enum([
  'music-folder',
  'tvshow-folder',
  'movie-folder',
])

export const metadataMediaFilesSchema = z.array(z.unknown())

export const metadataPlainObjectSchema = z.record(z.string(), z.unknown())

export const metadataPatchFieldSchemas = {
  type: metadataFolderTypeSchema.optional(),
  mediaFiles: metadataMediaFilesSchema.optional(),
  tvShow: metadataPlainObjectSchema.optional(),
  movie: metadataPlainObjectSchema.optional(),
} as const
