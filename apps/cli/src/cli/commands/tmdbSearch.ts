import { getCore } from '../../core/getCore'
import { formatTmdbSearchResults } from '../tmdbSearchFormat'

export interface TmdbSearchOptions {
  type: 'tv' | 'movie'
  host?: string
  password?: string
  proxy?: string
  lang?: string
}

export async function tmdbSearch(keyword: string, opts: TmdbSearchOptions): Promise<number> {
  try {
    const body = await getCore().searchInTmdb(keyword, {
      type: opts.type,
      host: opts.host,
      password: opts.password,
      proxy: opts.proxy,
      language: opts.lang,
    })
    if (body.error) {
      console.error(body.error)
      return 1
    }
    const text = formatTmdbSearchResults(body, opts.type)
    if (text) console.log(text)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
