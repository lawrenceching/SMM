import { z } from 'zod'
import { apiFetch } from '@/lib/apiFetch';

export type MediaDatabaseType = 'tmdb' | 'tvdb' | 'tmdb-asset' | 'tvdb-asset'
export type MediaDatabaseAuthorizationMethod = 'date-token' | 'none'

export type ReverseProxyType = 'general'

/**
 * Normalized media database entry returned by the CLI's `/api/discover`
 * endpoint. The remote config is fetched and normalized by the CLI.
 */
export interface MediaDatabaseEndpoint {
  type: MediaDatabaseType
  url: string
  authorizationMethod: MediaDatabaseAuthorizationMethod
}

export interface ReverseProxyEndpoint {
  id: string
  type: ReverseProxyType
  url: string
  authorizationMethod: MediaDatabaseAuthorizationMethod
}

export interface DiscoverConfig {
  mediaDatabases: MediaDatabaseEndpoint[]
  reverseProxies: ReverseProxyEndpoint[]
}

const endpointSchema = z.object({
  type: z.union([
    z.literal('tmdb'),
    z.literal('tvdb'),
    z.literal('tmdb-asset'),
    z.literal('tvdb-asset'),
  ]),
  url: z.string().min(1),
  authorizationMethod: z.union([z.literal('date-token'), z.literal('none')]),
})

const reverseProxySchema = z.object({
  id: z.string().min(1),
  type: z.literal('general'),
  url: z.string().min(1),
  authorizationMethod: z.union([z.literal('date-token'), z.literal('none')]),
})

const responseSchema = z.object({
  data: z
    .object({
      mediaDatabases: z.array(endpointSchema),
      reverseProxies: z.array(reverseProxySchema).optional(),
    })
    .optional(),
  error: z.string().optional(),
})

/**
 * Fetch the remote discovery configuration through the CLI.
 * Returns empty lists if the CLI returned no entries (e.g. on error).
 */
export async function fetchDiscoverConfig(): Promise<DiscoverConfig> {
  const resp = await apiFetch('/api/discover', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) {
    throw new Error(`Discover request failed: ${resp.status} ${resp.statusText}`)
  }
  const json = await resp.json()
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) {
    return { mediaDatabases: [], reverseProxies: [] }
  }
  return {
    mediaDatabases: parsed.data.data?.mediaDatabases ?? [],
    reverseProxies: parsed.data.data?.reverseProxies ?? [],
  }
}

/**
 * Fetch the remote media-database configuration through the CLI.
 * Returns an empty list if the CLI returned no entries (e.g. on error).
 */
export async function fetchDiscoveredMediaDatabases(): Promise<MediaDatabaseEndpoint[]> {
  const config = await fetchDiscoverConfig()
  return config.mediaDatabases
}
