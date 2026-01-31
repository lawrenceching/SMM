import { describe, it, expect, mock } from "bun:test";
import { handleGetApplicationContext } from "./getApplicationContextTool";

mock.module("@/utils/config", () => ({
  getUserConfig: () => mock(),
}));

describe("handleGetApplicationContext", () => {
  it("returns success with application context", async () => {
    const mockUserConfig = {
      selectedAI: "openai",
      applicationLanguage: "en",
      folders: [
        { path: "/media/tvshows", type: "tv" },
        { path: "/media/movies", type: "movie" },
      ],
      selectedRenameRule: "standard",
      tmdb: {
        apiKey: "test-api-key",
        language: "en-US",
      },
    };

    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.resolve(mockUserConfig),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.context).toEqual({
      selectedAI: "openai",
      applicationLanguage: "en",
      folders: [
        { path: "/media/tvshows", type: "tv" },
        { path: "/media/movies", type: "movie" },
      ],
      selectedRenameRule: "standard",
      tmdb: {
        apiKey: "test-api-key",
        language: "en-US",
      },
    });
  });

  it("handles undefined folders gracefully", async () => {
    const mockUserConfig = {
      selectedAI: "claude",
      applicationLanguage: "fr",
      folders: undefined,
      selectedRenameRule: "custom",
      tmdb: {
        apiKey: "another-api-key",
        language: "fr-FR",
      },
    };

    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.resolve(mockUserConfig),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.context.folders).toEqual([]);
  });

  it("handles minimal config object", async () => {
    const mockUserConfig = {};

    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.resolve(mockUserConfig),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.context).toEqual({
      selectedAI: undefined,
      applicationLanguage: undefined,
      folders: [],
      selectedRenameRule: undefined,
      tmdb: undefined,
    });
  });

  it("handles config errors gracefully", async () => {
    const mockError = new Error("Config file not found");

    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.reject(mockError),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting application context: Config file not found");
  });

  it("handles string errors gracefully", async () => {
    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.reject("String error"),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting application context: String error");
  });

  it("preserves all config properties in context", async () => {
    const mockUserConfig = {
      selectedAI: "gemini",
      applicationLanguage: "es",
      folders: [
        { path: "/series", type: "tv" },
        { path: "/peliculas", type: "movie" },
        { path: "/documentales", type: "documentary" },
      ],
      selectedRenameRule: "spanish",
      tmdb: {
        apiKey: "spanish-api-key",
        language: "es-ES",
        includeAdult: false,
      },
      someOtherProperty: "should not be included",
      anotherProperty: 123,
    };

    mock.module("@/utils/config", () => ({
      getUserConfig: () => Promise.resolve(mockUserConfig),
    }));

    const { handleGetApplicationContext: reimportedHandler } = await import("./getApplicationContextTool");

    const result = await reimportedHandler();

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    
    // Check that only the expected properties are included
    expect(Object.keys(parsed.context)).toEqual([
      "selectedAI",
      "applicationLanguage", 
      "folders",
      "selectedRenameRule",
      "tmdb",
    ]);
    
    // Check values
    expect(parsed.context.selectedAI).toBe("gemini");
    expect(parsed.context.applicationLanguage).toBe("es");
    expect(parsed.context.folders).toHaveLength(3);
    expect(parsed.context.selectedRenameRule).toBe("spanish");
    expect(parsed.context.tmdb).toEqual({
      apiKey: "spanish-api-key",
      language: "es-ES",
      includeAdult: false,
    });
    
    // Check that extra properties are not included
    expect(parsed.context.someOtherProperty).toBeUndefined();
    expect(parsed.context.anotherProperty).toBeUndefined();
  });
});