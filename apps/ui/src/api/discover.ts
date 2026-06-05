import { z } from 'zod'

export type MediaDatabaseType = 'tmdb' | 'tvdb'
export type MediaDatabaseAuthorizationMethod = 'date-token' | 'none'

/**
 * Normalized media database entry returned by the CLI's `/api/discover`
 * endpoint. The remote config is fetched and normalized by the CLI.
 */
export interface MediaDatabaseEndpoint {
  type: MediaDatabaseType
  url: string
  authorizationMethod: MediaDatabaseAuthorizationMethod
}

const endpointSchema = z.object({
  type: z.union([z.literal('tmdb'), z.literal('tvdb')]),
  url: z.string().min(1),
  authorizationMethod: z.union([z.literal('date-token'), z.literal('none')]),
})

const responseSchema = z.object({
  data: z
    .object({
      mediaDatabases: z.array(endpointSchema),
    })
    .optional(),
  error: z.string().optional(),
})

/**
 * Fetch the remote media-database configuration through the CLI.
 * Returns an empty list if the CLI returned no entries (e.g. on error).
 */
export async function fetchDiscoveredMediaDatabases(): Promise<MediaDatabaseEndpoint[]> {
  const resp = await fetch('/api/discover', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) {
    throw new Error(`Discover request failed: ${resp.status} ${resp.statusText}`)
  }
  const json = await resp.json()
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) {
    return []
  }
  return parsed.data.data?.mediaDatabases ?? []
}
