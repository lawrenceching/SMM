import { describe, expect, it } from "vitest";
import type { EpisodeNfo, TvShowNFO } from "./nfoTypes";
import {
  convertTvShowEpisodeNfoToXml,
  convertTvShowNfoToXml,
} from "./nfoXml";

describe("convertTvShowNfoToXml", () => {
  it("includes title and tmdbid in tvshow XML", () => {
    const nfo: TvShowNFO = {
      title: "Test Show",
      tmdbid: "123876",
      id: "123876",
    };

    const xml = convertTvShowNfoToXml(nfo);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    expect(xml).toContain("<tvshow>");
    expect(xml).toContain("<title>Test Show</title>");
    expect(xml).toContain("<tmdbid>123876</tmdbid>");
  });

  it("serializes ratings, uniqueIds, and fanart thumbs", () => {
    const nfo: TvShowNFO = {
      title: "Rated Show",
      tmdbid: "99",
      ratings: [
        {
          default: true,
          max: 10,
          name: "themoviedb",
          value: 8.5,
          votes: 100,
        },
      ],
      uniqueIds: [{ default: true, type: "tmdb", value: "99" }],
      fanartThumbs: ["https://image.tmdb.org/t/p/original/fan.jpg"],
    };

    const xml = convertTvShowNfoToXml(nfo);

    expect(xml).toContain('name="themoviedb"');
    expect(xml).toContain("<value>8.5</value>");
    expect(xml).toContain('<uniqueid default="true" type="tmdb">99</uniqueid>');
    expect(xml).toContain("<fanart>");
    expect(xml).toContain("https://image.tmdb.org/t/p/original/fan.jpg");
  });
});

describe("convertTvShowEpisodeNfoToXml", () => {
  it("includes title and episode metadata in episodedetails XML", () => {
    const nfo: EpisodeNfo = {
      title: "Episode One",
      showTitle: "Test Show",
      season: 1,
      episode: 1,
      id: "8415207",
      uniqueIds: [{ default: true, type: "tmdb", value: "8415207" }],
    };

    const xml = convertTvShowEpisodeNfoToXml(nfo);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    expect(xml).toContain("<episodedetails>");
    expect(xml).toContain("<title>Episode One</title>");
    expect(xml).toContain("<showtitle>Test Show</showtitle>");
    expect(xml).toContain("<season>1</season>");
    expect(xml).toContain("<episode>1</episode>");
    expect(xml).toContain('<uniqueid default="true" type="tmdb">8415207</uniqueid>');
  });
});
