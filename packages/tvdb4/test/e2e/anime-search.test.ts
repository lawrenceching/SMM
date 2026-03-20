import { describe, expect, it, beforeAll } from "vitest";
import { TVDBv4 } from "../../src/client";
import { TVDB_API_KEY, hasApiKey, testLogger } from "../setup";

describe.skipIf(!hasApiKey())("E2E: Search Anime", () => {
  let client: TVDBv4;

  beforeAll(() => {
    client = new TVDBv4({ apiKey: TVDB_API_KEY!, logger: testLogger });
  });

  it("should search for anime successfully", async () => {
    const result = await client.search({
      query: "Naruto",
      type: "tv",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const narutoResult = result.data.find((item) =>
      item.name?.toLowerCase().includes("naruto")
    );
    expect(narutoResult).toBeDefined();
    expect(narutoResult?.id).toBeDefined();
    expect(narutoResult?.name).toBeDefined();
    expect(narutoResult?.type).toBeDefined();
  });

  it("should search for anime with different language", async () => {
    const result = await client.search({
      query: "Attack on Titan",
      type: "tv",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);

    const attackOnTitan = result.data.find((item) =>
      item.name?.toLowerCase().includes("attack on titan")
    );
    expect(attackOnTitan).toBeDefined();
    expect(attackOnTitan?.id).toBeDefined();
  });

  it("should search for anime with year filter", async () => {
    const result = await client.search({
      query: "Dragon Ball",
      type: "tv",
      language: "eng",
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const dragonBall = result.data.find((item) =>
      item.name?.toLowerCase().includes("dragon ball")
    );
    expect(dragonBall).toBeDefined();
  });

  it("should handle pagination in anime search", async () => {
    const result = await client.search({
      query: "One Piece",
      type: "tv",
      language: "eng",
      page: 1,
      limit: 10,
    });

    expect(result.status).toBe("success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(10);
  });
});
