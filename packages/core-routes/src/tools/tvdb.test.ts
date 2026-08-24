import { describe, expect, it, vi } from "vitest";
import {
  executeTvdbGetLanguages,
  executeTvdbGetMovie,
  executeTvdbGetTvShow,
  executeTvdbSearch,
} from "./tvdb.ts";

describe("executeTvdbSearch", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeTvdbSearch({ keyword: "naruto", type: "series" }, undefined);
    expect(result.error).toMatch(/not available/i);
  });

  it("maps keyword/type/language to Core runner", async () => {
    const runner = vi.fn(async () => [{ tvdb_id: "1", name: "Show" }]);
    const result = await executeTvdbSearch(
      { keyword: "naruto", type: "series", language: "zho", baseURL: "https://tvdb.example/v4" },
      runner,
    );
    expect(result.results).toHaveLength(1);
    expect(runner).toHaveBeenCalledWith("naruto", {
      type: "series",
      language: "zho",
      host: "https://tvdb.example/v4",
    });
  });

  it("returns error when runner throws", async () => {
    const runner = vi.fn(async () => { throw new Error("upstream failed"); });
    const result = await executeTvdbSearch({ keyword: "x", type: "movie" }, runner);
    expect(result.error).toMatch(/upstream failed/);
  });
});

describe("executeTvdbGetMovie / GetTvShow", () => {
  it("returns unavailable when runner is missing", async () => {
    const movie = await executeTvdbGetMovie({ id: 2 }, undefined);
    expect(movie.error).toMatch(/not available/i);
    const show = await executeTvdbGetTvShow({ id: 1 }, undefined);
    expect(show.error).toMatch(/not available/i);
  });

  it("validates id", async () => {
    const movie = await executeTvdbGetMovie({ id: 0 }, vi.fn());
    expect(movie.error).toMatch(/positive integer/i);
  });

  it("returns metadata on success", async () => {
    const runner = vi.fn(async () => ({ id: "2", name: "My Film", database: "TVDB" }));
    const result = await executeTvdbGetMovie({ id: 2, language: "eng" }, runner);
    expect(result.name).toBe("My Film");
    expect(runner).toHaveBeenCalledWith(2, { language: "eng", host: undefined });
  });
});

describe("executeTvdbGetLanguages", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeTvdbGetLanguages(undefined);
    expect(result.error).toMatch(/not available/i);
  });

  it("returns languages on success", async () => {
    const runner = vi.fn(async () => [{ id: "zho", name: "Chinese" }]);
    const result = await executeTvdbGetLanguages(runner);
    expect(result.languages).toEqual([{ id: "zho", name: "Chinese" }]);
  });
});
