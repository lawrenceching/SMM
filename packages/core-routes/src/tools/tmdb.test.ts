import { describe, expect, it, vi } from "vitest";
import type {
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeriesDetails,
  TMDBTVShow,
} from "@smm/types";
import {
  executeTmdbGetMovie,
  executeTmdbGetTvShow,
  executeTmdbSearch,
} from "./tmdb.ts";

describe("executeTmdbSearch", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeTmdbSearch(
      { keyword: "naruto", type: "tv" },
      undefined,
    );
    expect(result.error).toMatch(/not available/i);
  });

  it("maps keyword and type to Core runner", async () => {
    const runner = vi.fn(async (): Promise<TmdbSearchResponseBody> => ({
      results: [{ id: 1, name: "Show" } as TMDBTVShow],
      page: 1,
      total_pages: 1,
      total_results: 1,
    }));
    const result = await executeTmdbSearch(
      { keyword: "naruto", type: "tv", baseURL: "https://tmdb.example/v3" },
      runner,
    );
    expect(result.results).toHaveLength(1);
    expect(runner).toHaveBeenCalledWith("naruto", {
      type: "tv",
      host: "https://tmdb.example/v3",
      language: undefined,
    });
  });

  it("returns body.error from runner", async () => {
    const runner = vi.fn(async () => ({
      results: [],
      page: 1,
      total_pages: 0,
      total_results: 0,
      error: "upstream failed",
    }));
    const result = await executeTmdbSearch({ keyword: "x", type: "movie" }, runner);
    expect(result.error).toBe("upstream failed");
  });
});

describe("executeTmdbGetMovie", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeTmdbGetMovie({ id: 550 }, undefined);
    expect(result.error).toMatch(/not available/i);
  });

  it("returns movie details on success", async () => {
    const runner = vi.fn(async (): Promise<TmdbMovieDetails> => ({
      id: 550,
      title: "Fight Club",
    } as TmdbMovieDetails));
    const result = await executeTmdbGetMovie({ id: 550, language: "en-US" }, runner);
    expect(result.title).toBe("Fight Club");
    expect(runner).toHaveBeenCalledWith(550, { language: "en-US", host: undefined });
  });
});

describe("executeTmdbGetTvShow", () => {
  it("validates id", async () => {
    const result = await executeTmdbGetTvShow({ id: 0 }, vi.fn());
    expect(result.error).toMatch(/positive integer/i);
  });

  it("returns series details on success", async () => {
    const runner = vi.fn(async (): Promise<TmdbSeriesDetails> => ({
      id: 31917,
      name: "Show",
    } as TmdbSeriesDetails));
    const result = await executeTmdbGetTvShow({ id: 31917 }, runner);
    expect(result.name).toBe("Show");
  });
});
