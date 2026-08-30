import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/types";
import { describe, expect, it, vi } from "vitest";
import { buildTvShowEpisodeNfo, buildTvShowNfo } from "./buildTvShowNfoTmdb";

const seriesDetails: TmdbSeriesDetails = {
  id: 123876,
  name: "Test Show",
  original_name: "Original Show",
  overview: "Show overview",
  poster_path: "/poster.jpg",
  backdrop_path: "/fanart.jpg",
  first_air_date: "2021-01-15",
  vote_average: 8.3,
  vote_count: 545,
  popularity: 100,
  genre_ids: [16, 35],
  origin_country: ["JP"],
  number_of_seasons: 1,
  number_of_episodes: 1,
  seasons: [],
  status: "Ended",
  type: "Scripted",
  in_production: false,
  last_air_date: "2021-03-26",
  networks: [],
  production_companies: [{ id: 1, name: "Studio Alpha", logo_path: null }],
  genres: [{ id: 16, name: "Animation" }],
  production_countries: [{ iso_3166_1: "JP", name: "Japan" }],
  logo_path: "/logo.png",
} as TmdbSeriesDetails;

const seasonDetails: TmdbSeasonDetails = {
  id: 1,
  name: "Season 1",
  overview: "Season overview",
  poster_path: "/season1.jpg",
  season_number: 1,
  air_date: "2021-01-15",
  episode_count: 1,
  episodes: [
    {
      id: 8415207,
      name: "Episode One",
      overview: "Episode overview",
      still_path: "/still.jpg",
      air_date: "2021-01-15",
      episode_number: 1,
      season_number: 1,
      runtime: 24,
      vote_average: 7.8,
      vote_count: 13,
      crew: [
        {
          department: "Directing",
          job: "Director",
          credit_id: "c1",
          adult: false,
          gender: 0,
          id: 100,
          known_for_department: "Directing",
          name: "Director One",
          original_name: "Director One",
          popularity: 1,
          profile_path: null,
        },
        {
          department: "Writing",
          job: "Writer",
          credit_id: "c2",
          adult: false,
          gender: 0,
          id: 101,
          known_for_department: "Writing",
          name: "Writer One",
          original_name: "Writer One",
          popularity: 1,
          profile_path: null,
        },
      ],
      guest_stars: [
        {
          character: "Guest Role",
          credit_id: "g1",
          order: 1,
          adult: false,
          gender: 0,
          id: 200,
          known_for_department: "Acting",
          name: "Guest Star",
          original_name: "Guest Star",
          popularity: 1,
          profile_path: "/guest.jpg",
        },
      ],
    },
  ],
};

describe("buildTvShowNfo", () => {
  it("maps TMDB series details to TvShowNFO fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));

    const nfo = buildTvShowNfo(seriesDetails, [seasonDetails]);

    expect(nfo.title).toBe("Test Show");
    expect(nfo.originalTitle).toBe("Original Show");
    expect(nfo.showTitle).toBe("Test Show");
    expect(nfo.year).toBe(2021);
    expect(nfo.tmdbid).toBe("123876");
    expect(nfo.id).toBe("123876");
    expect(nfo.episodeguide).toBe(JSON.stringify({ tmdb: "123876" }));
    expect(nfo.ratings).toEqual([
      {
        default: true,
        max: 10,
        name: "themoviedb",
        value: 8.3,
        votes: 545,
      },
    ]);
    expect(nfo.uniqueIds).toEqual([
      { default: true, type: "tmdb", value: "123876" },
    ]);
    expect(nfo.thumbs).toEqual([
      {
        url: "https://image.tmdb.org/t/p/original/poster.jpg",
        aspect: "poster",
      },
      {
        url: "https://image.tmdb.org/t/p/original/logo.png",
        aspect: "clearlogo",
      },
      {
        url: "https://image.tmdb.org/t/p/original/season1.jpg",
        aspect: "poster",
        season: 1,
        type: "season",
      },
    ]);
    expect(nfo.namedSeasons).toEqual([{ number: 1, name: "Season 1" }]);
    expect(nfo.fanartThumbs).toEqual([
      "https://image.tmdb.org/t/p/original/fanart.jpg",
    ]);
    expect(nfo.runtime).toBe(24);
    expect(nfo.genres).toEqual(["Animation"]);
    expect(nfo.studios).toEqual(["Studio Alpha"]);
    expect(nfo.countries).toEqual(["Japan"]);
    expect(nfo.dateadded).toBe("2026-08-19 12:00:00");

    vi.useRealTimers();
  });
});

describe("buildTvShowEpisodeNfo", () => {
  it("maps TMDB episode details to EpisodeNfo fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));

    const episode = seasonDetails.episodes![0]!;
    const nfo = buildTvShowEpisodeNfo(seriesDetails, seasonDetails, episode);

    expect(nfo.id).toBe("8415207");
    expect(nfo.title).toBe("Episode One");
    expect(nfo.showTitle).toBe("Test Show");
    expect(nfo.season).toBe(1);
    expect(nfo.episode).toBe(1);
    expect(nfo.plot).toBe("Episode overview");
    expect(nfo.runtime).toBe(24);
    expect(nfo.thumb).toBe("https://image.tmdb.org/t/p/original/still.jpg");
    expect(nfo.uniqueIds).toEqual([
      { default: true, type: "tmdb", value: "8415207" },
    ]);
    expect(nfo.ratings).toEqual([
      {
        default: false,
        max: 10,
        name: "themoviedb",
        value: 7.8,
        votes: 13,
      },
    ]);
    expect(nfo.directors).toEqual([{ tmdbid: "100", name: "Director One" }]);
    expect(nfo.credits).toEqual([{ tmdbid: "101", name: "Writer One" }]);
    expect(nfo.actors).toEqual([
      {
        name: "Guest Star",
        role: "Guest Role",
        thumb: "https://image.tmdb.org/t/p/original/guest.jpg",
        profile: "https://www.themoviedb.org/person/200",
        type: "GuestStar",
        tmdbid: "200",
      },
    ]);
    expect(nfo.dateadded).toBe("2026-08-19 12:00:00");

    vi.useRealTimers();
  });
});
