import { describe, expect, it, beforeAll } from "vitest";
import { TVDBv4 } from "../../src/client";
import { TVDB_API_KEY, hasApiKey, testLogger } from "../setup";

describe.skipIf(!hasApiKey())("E2E: Get TV Show Seasons and Episodes", () => {
  let client: TVDBv4;

  beforeAll(async () => {
    client = new TVDBv4({ apiKey: TVDB_API_KEY!, logger: testLogger });

    const searchResult = await client.search({
      query: "Breaking Bad",
      type: "tv",
      language: "eng",
    });

    const breakingBad = searchResult.data.find((item) =>
      item.name?.toLowerCase().includes("breaking bad")
    );
    expect(breakingBad).toBeDefined();
  });

  it("should get seasons", async () => {
    const result = await client.getSeasons({ page: 1 });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const season = result.data[0];
    expect(season).toBeDefined();
    expect(season?.id).toBeDefined();
  });

  it("should get episodes", async () => {
    const result = await client.getEpisodes({ page: 1 });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const episode = result.data[0];
    expect(episode.id).toBeDefined();
  });

  it("should get episode by ID", async () => {
    const episodesResult = await client.getEpisodes({ page: 1 });
    const firstEpisode = episodesResult.data[0];

    if (firstEpisode.id) {
      const result = await client.getEpisodeById(firstEpisode.id);

      expect(result.status).toBe("success");
      expect(result.data.id).toBe(firstEpisode.id);
    }
  });

  it("should get seasons with pagination", async () => {
    const page1 = await client.getSeasons({ page: 1 });

    expect(page1.status).toBe("success");
    expect(Array.isArray(page1.data)).toBe(true);

    if (page1.links?.next) {
      const page2 = await client.getSeasons({ page: 2 });
      expect(page2.status).toBe("success");
      expect(Array.isArray(page2.data)).toBe(true);
    }
  });

  it("should get episodes with pagination", async () => {
    const page1 = await client.getEpisodes({ page: 1 });

    expect(page1.status).toBe("success");
    expect(Array.isArray(page1.data)).toBe(true);

    if (page1.links?.next) {
      const page2 = await client.getEpisodes({ page: 2 });
      expect(page2.status).toBe("success");
      expect(Array.isArray(page2.data)).toBe(true);
    }
  });
});
