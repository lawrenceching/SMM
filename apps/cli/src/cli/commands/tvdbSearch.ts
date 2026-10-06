import { getCore } from '@smm/server'
import { formatTvdbSearchResults } from '../tvdbSearchFormat'

export interface TvdbSearchOptions {
  type: 'series' | 'movie'
  host?: string
  password?: string
  proxy?: string
  lang?: string
}

export async function tvdbSearch(keyword: string, opts: TvdbSearchOptions): Promise<number> {
  try {
    const results = await getCore().searchInTvdb(keyword, {
      type: opts.type,
      host: opts.host,
      password: opts.password,
      proxy: opts.proxy,
      language: opts.lang,
    })
    const text = formatTvdbSearchResults(results, opts.type)
    if (text) console.log(text)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
