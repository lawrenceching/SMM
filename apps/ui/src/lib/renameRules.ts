import { extname } from "@/lib/path"

export type RenameRuleName = "plex" | "emby"

export interface NewFileNameContext {
  type: "tv" | "movie"
  seasonNumber: number
  episodeNumber: number
  episodeName?: string
  tvshowName?: string
  movieName?: string
  file: string
  tmdbId?: string
  releaseYear: string
}

function generateMovieFileName(context: NewFileNameContext, ext: string): string {
  const year = context.releaseYear || ""
  const name = context.movieName ?? ""
  return `${name}${year ? ` (${year})` : ""}${ext}`
}

function generatePlexTvFileName(context: NewFileNameContext, ext: string): string {
  const season = context.seasonNumber.toString().padStart(2, "0")
  const episode = context.episodeNumber.toString().padStart(2, "0")
  const folder = `Season ${season}`
  return `${folder}/${context.tvshowName} - S${season}E${episode} - ${context.episodeName}${ext}`
}

function generateEmbyTvFileName(context: NewFileNameContext, ext: string): string {
  const season = context.seasonNumber.toString()
  const episode = context.episodeNumber.toString()
  const folder = `Season ${season}`
  return `${folder}/${context.tvshowName} S${season}E${episode} ${context.episodeName}${ext}`
}

export function generateNewFileName(
  ruleName: RenameRuleName,
  context: NewFileNameContext,
): string {
  const ext = extname(context.file)

  if (context.type === "movie") {
    return generateMovieFileName(context, ext)
  }

  if (ruleName === "plex") {
    return generatePlexTvFileName(context, ext)
  }

  return generateEmbyTvFileName(context, ext)
}
