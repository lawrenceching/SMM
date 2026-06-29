import { describe, it, expect } from "vitest";
import { redactUserConfig } from "./redactUserConfig";

describe("redactUserConfig", () => {
  it("returns an empty object for an empty input", () => {
    expect(redactUserConfig({})).toEqual({});
  });

  it("redacts tmdb.apiKey", () => {
    const input = { tmdb: { apiKey: "tmdb-secret" } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe("******");
  });

  it("redacts tvdb.apiKey", () => {
    const input = { tvdb: { apiKey: "tvdb-secret" } };
    expect(redactUserConfig(input).tvdb.apiKey).toBe("******");
  });

  it("redacts every entry in ai: Record<string, OpenAICompatibleConfig>", () => {
    const input = {
      ai: {
        openai: { apiKey: "openai-secret" },
        custom: { apiKey: "custom-secret" },
      },
    };
    const result = redactUserConfig(input);
    expect(result.ai.openai.apiKey).toBe("******");
    expect(result.ai.custom.apiKey).toBe("******");
  });

  it("redacts every element in aiProviders: Array<OpenAICompatibleConfig>", () => {
    const input = {
      aiProviders: [
        { name: "p1", apiKey: "k1" },
        { name: "p2", apiKey: "k2" },
      ],
    };
    const result = redactUserConfig(input);
    expect(result.aiProviders[0].apiKey).toBe("******");
    expect(result.aiProviders[1].apiKey).toBe("******");
  });

  it("walks deeply nested objects", () => {
    const input = { a: { b: { c: { apiKey: "deep-secret" } } } };
    expect(redactUserConfig(input).a.b.c.apiKey).toBe("******");
  });

  it("walks array elements", () => {
    const input = { providers: [{ items: [{ apiKey: "nested-secret" }] }] };
    expect(redactUserConfig(input).providers[0].items[0].apiKey).toBe("******");
  });

  it("does not mutate the input", () => {
    const input = { tmdb: { apiKey: "secret" }, tvdb: { apiKey: "secret" } };
    const snapshot = JSON.parse(JSON.stringify(input));
    redactUserConfig(input);
    expect(input).toEqual(snapshot);
  });

  it("leaves non-string apiKey values alone", () => {
    const input = { tmdb: { apiKey: 42 as unknown as string } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe(42);
  });

  it("leaves empty string apiKey alone", () => {
    const input = { tmdb: { apiKey: "" } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe("");
  });

  it("returns '[Circular]' for cycle leaves", () => {
    const input: { tmdb: { self?: unknown; apiKey: string } } = {
      tmdb: { apiKey: "secret" },
    };
    input.tmdb.self = input;
    const result = redactUserConfig(input);
    expect(result.tmdb.self).toBe("[Circular]");
  });

  it("preserves non-apiKey fields verbatim", () => {
    const input = {
      tmdb: { host: "http://api.tmdb.org", apiKey: "secret" },
      folders: ["/a", "/b"],
    };
    const result = redactUserConfig(input);
    expect(result.tmdb.host).toBe("http://api.tmdb.org");
    expect(result.folders).toEqual(["/a", "/b"]);
  });
});
