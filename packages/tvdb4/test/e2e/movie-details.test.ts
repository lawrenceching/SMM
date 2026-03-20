import { describe, expect, it, beforeAll } from "vitest";
import { TVDBv4 } from "../../src/client";
import { TVDB_API_KEY, hasApiKey, testLogger } from "../setup";

describe.skipIf(!hasApiKey())("E2E: Get Movie Details", () => {
  let client: TVDBv4;

  beforeAll(async () => {
    client = new TVDBv4({ apiKey: TVDB_API_KEY!, logger: testLogger });
  });

  it("should get movies list", async () => {
    const result = await client.getMovies({ page: 1 });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const movie = result.data[0];
    expect(movie.id).toBeDefined();
  });

  it("should get movies with pagination", async () => {
    const page1 = await client.getMovies({ page: 1 });

    expect(page1.status).toBe("success");
    expect(Array.isArray(page1.data)).toBe(true);

    if (page1.links?.next) {
      const page2 = await client.getMovies({ page: 2 });
      expect(page2.status).toBe("success");
      expect(Array.isArray(page2.data)).toBe(true);
    }
  });

  it("should search for movie successfully", async () => {
    const result = await client.search({
      query: "The Matrix",
      type: "movie",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const matrixResult = result.data.find((item) =>
      item.name?.toLowerCase().includes("matrix")
    );
    expect(matrixResult).toBeDefined();
    expect(matrixResult?.id).toBeDefined();
    expect(matrixResult?.name).toBeDefined();
    expect(matrixResult?.type).toBeDefined();
  });

  it("should search and verify movie exists in results", async () => {
    const searchResult = await client.search({
      query: "Pulp Fiction",
      type: "movie",
      language: "eng",
    });

    const pulpFiction = searchResult.data.find((item) =>
      item.name?.toLowerCase().includes("pulp fiction")
    );
    expect(pulpFiction).toBeDefined();
    expect(pulpFiction?.id).toBeDefined();
    expect(pulpFiction?.name).toMatch(/pulp fiction/i);
  });

  it("should search for multiple movies", async () => {
    const result = await client.search({
      query: "The Godfather",
      type: "movie",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);

    const godfather = result.data.find((item) =>
      item.name?.toLowerCase().includes("godfather")
    );
    expect(godfather).toBeDefined();
    expect(godfather?.id).toBeDefined();
    expect(godfather?.name).toMatch(/godfather/i);
  });
});
