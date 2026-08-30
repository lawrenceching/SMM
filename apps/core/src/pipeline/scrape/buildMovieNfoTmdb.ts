import type { TmdbMovieDetails } from "@smm/core";
import { getTmdbImageUrl } from "./tmdbImageUrl";
import type { MovieNFO } from "./nfoTypes";

export function buildMovieNfoTmdb(tmdbMovieDetails: TmdbMovieDetails): MovieNFO {
  const thumbs: MovieNFO["thumbs"] = [];
  const poster = getTmdbImageUrl(tmdbMovieDetails.poster_path, "original");
  if (poster) {
    thumbs.push({ url: poster, aspect: "poster" });
  }
  const fanart = getTmdbImageUrl(tmdbMovieDetails.backdrop_path, "original");
  const imdbId = tmdbMovieDetails.imdb_id ?? undefined;
  const uniqueIds: MovieNFO["uniqueIds"] = [
    { default: true, type: "tmdb", value: String(tmdbMovieDetails.id) },
  ];
  if (imdbId) {
    uniqueIds.push({ default: false, type: "imdb", value: imdbId });
  }

  return {
    title: tmdbMovieDetails.title,
    originalTitle: tmdbMovieDetails.original_title,
    sortTitle: tmdbMovieDetails.title,
    year: Number.parseInt(tmdbMovieDetails.release_date?.slice(0, 4) ?? "", 10) || undefined,
    ratings: [
      {
        default: true,
        max: 10,
        name: "themoviedb",
        value: tmdbMovieDetails.vote_average,
        votes: tmdbMovieDetails.vote_count,
      },
    ],
    userRating: 0,
    top250: 0,
    set: tmdbMovieDetails.belongs_to_collection?.name
      ? {
          name: tmdbMovieDetails.belongs_to_collection.name,
          overview: tmdbMovieDetails.belongs_to_collection.name,
        }
      : undefined,
    plot: tmdbMovieDetails.overview,
    outline: tmdbMovieDetails.overview,
    tagline: tmdbMovieDetails.tagline ?? undefined,
    runtime: tmdbMovieDetails.runtime ?? undefined,
    thumbs: thumbs.length > 0 ? thumbs : undefined,
    fanartThumbs: fanart ? [fanart] : undefined,
    id: imdbId ?? String(tmdbMovieDetails.id),
    imdbid: imdbId,
    tmdbid: String(tmdbMovieDetails.id),
    uniqueIds,
    countries: (tmdbMovieDetails.production_countries ?? []).map((c) => c.name).filter(Boolean),
    status: tmdbMovieDetails.status || undefined,
    premiered: tmdbMovieDetails.release_date || undefined,
    watched: false,
    playcount: 0,
    genres: (tmdbMovieDetails.genres ?? []).map((g) => g.name).filter(Boolean),
    studios: (tmdbMovieDetails.production_companies ?? []).map((c) => c.name).filter(Boolean),
    languages:
      (tmdbMovieDetails.spoken_languages ?? [])
        .map((l) => l.name || l.english_name)
        .filter(Boolean)
        .join(" / ") || undefined,
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}
