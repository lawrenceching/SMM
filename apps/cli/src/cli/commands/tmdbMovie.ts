import { getCore } from '@smm/server'
import { formatTmdbDetailsTree } from '../tmdbDetailsFormat'
import { printJson } from './shared'

export interface TmdbGetOptions {
  format?: string
  host?: string
  password?: string
  proxy?: string
  lang?: string
}

export async function tmdbMovie(tmdbIdRaw: string, opts: TmdbGetOptions): Promise<number> {
  try {
    const id = Number(tmdbIdRaw)
    if (!Number.isInteger(id) || id <= 0) {
      console.error('id must be a positive integer')
      return 1
    }
    const details = await getCore().getMovieInTmdb(id, {
      language: opts.lang,
      host: opts.host,
      password: opts.password,
      proxy: opts.proxy,
    })
    if (opts.format === 'json') {
      printJson(details)
      return 0
    }
    console.log(formatTmdbDetailsTree(details))
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
