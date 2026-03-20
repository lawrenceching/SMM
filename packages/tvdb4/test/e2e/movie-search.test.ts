import { describe, expect, it, beforeAll } from "vitest";
import { TVDBv4 } from "../../src/client";
import { TVDB_API_KEY, hasApiKey, testLogger } from "../setup";

describe.skipIf(!hasApiKey())("E2E: Search Movie", () => {
  let client: TVDBv4;

  beforeAll(() => {
    client = new TVDBv4({ apiKey: TVDB_API_KEY!, logger: testLogger });
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

  it("should search for movie with different language", async () => {
    const result = await client.search({
      query: "Inception",
      type: "movie",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);

    const inception = result.data.find((item) =>
      item.name?.toLowerCase().includes("inception")
    );
    expect(inception).toBeDefined();
    expect(inception?.id).toBeDefined();
  });

  it("should search for movie with year filter", async () => {
    const result = await client.search({
      query: "Interstellar",
      type: "movie",
      language: "eng",
      year: 2014,
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);

    const interstellar = result.data.find((item) =>
      item.name?.toLowerCase().includes("interstellar")
    );
    expect(interstellar).toBeDefined();
  });

  it("should handle pagination in movie search", async () => {
    const result = await client.search({
      query: "Star Wars",
      type: "movie",
      language: "eng",
      page: 1,
      limit: 10,
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(10);
  });

  it("should search for movie with director filter", async () => {
    const result = await client.search({
      query: "Christopher Nolan",
      type: "movie",
      language: "eng",
      director: "Christopher Nolan",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
  });
});
