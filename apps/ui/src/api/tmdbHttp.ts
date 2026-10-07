import { rpc, unwrapJson } from '@/lib/rpc'

interface TmdbCoreRequestOptions {
  language?: string
  host?: string
  password?: string
  proxy?: string
}

export interface SearchInTmdbParams extends TmdbCoreRequestOptions {
  keyword: string
  type: 'tv' | 'movie'
}

export interface GetTmdbByIdParams extends TmdbCoreRequestOptions {
  id: number
}

export type SearchInTmdbResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['search-in-tmdb']['$post']>>['json']>
>

export type GetMovieInTmdbResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['get-movie-in-tmdb']['$post']>>['json']>
>

export type GetTvShowInTmdbResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['get-tvshow-in-tmdb']['$post']>>['json']>
>

function optionalFields(options?: TmdbCoreRequestOptions): Record<string, string> {
  const body: Record<string, string> = {}
  if (options?.language) body.language = options.language
  if (options?.host) body.host = options.host
  if (options?.password) body.password = options.password
  if (options?.proxy) body.proxy = options.proxy
  return body
}

/** `POST /api/search-in-tmdb` → `Core.searchInTmdb`. */
export async function searchInTmdb(
  params: SearchInTmdbParams,
  signal?: AbortSignal,
): Promise<SearchInTmdbResponseBody> {
  const resp = await rpc.api['search-in-tmdb'].$post(
    {
      json: {
        keyword: params.keyword,
        type: params.type,
        ...optionalFields(params),
      },
    },
    { init: { signal } },
  )
  return unwrapJson(resp)
}

/** `POST /api/get-movie-in-tmdb` → `Core.getMovieInTmdb`. */
export async function getMovieInTmdb(
  params: GetTmdbByIdParams,
  signal?: AbortSignal,
): Promise<GetMovieInTmdbResponseBody> {
  const resp = await rpc.api['get-movie-in-tmdb'].$post(
    { json: { id: params.id, ...optionalFields(params) } },
    { init: { signal } },
  )
  return unwrapJson(resp)
}

/** `POST /api/get-tvshow-in-tmdb` → `Core.getTvShowInTmdb`. */
export async function getTvShowInTmdb(
  params: GetTmdbByIdParams,
  signal?: AbortSignal,
): Promise<GetTvShowInTmdbResponseBody> {
  const resp = await rpc.api['get-tvshow-in-tmdb'].$post(
    { json: { id: params.id, ...optionalFields(params) } },
    { init: { signal } },
  )
  return unwrapJson(resp)
}
