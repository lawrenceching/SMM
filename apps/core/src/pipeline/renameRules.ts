import { extname } from "./paths";

export type RenameRuleName = "plex" | "emby";

export interface NewFileNameContext {
  type: "tv" | "movie";
  seasonNumber: number;
  episodeNumber: number;
  episodeName?: string;
  tvshowName?: string;
  movieName?: string;
  file: string;
  tmdbId?: string;
  releaseYear: string;
}

function generatePlexTvFileName(context: NewFileNameContext, ext: string): string {
  const season = context.seasonNumber.toString().padStart(2, "0");
  const episode = context.episodeNumber.toString().padStart(2, "0");
  const folder = `Season ${season}`;
  return `${folder}/${context.tvshowName} - S${season}E${episode} - ${context.episodeName}${ext}`;
}

function generateEmbyTvFileName(context: NewFileNameContext, ext: string): string {
  const season = context.seasonNumber.toString();
  const episode = context.episodeNumber.toString();
  const folder = `Season ${season}`;
  return `${folder}/${context.tvshowName} S${season}E${episode} ${context.episodeName}${ext}`;
}

export function generateNewFileName(
  ruleName: RenameRuleName,
  context: NewFileNameContext,
): string {
  if (context.type !== "tv") {
    throw new Error("Only TV rename is supported");
  }

  const ext = extname(context.file);

  if (ruleName === "plex") {
    return generatePlexTvFileName(context, ext);
  }

  return generateEmbyTvFileName(context, ext);
}
