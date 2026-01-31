import { describe, it, expect } from "bun:test";
import { handleGetMediaMetadata } from "./getMediaMetadataTool";

describe("handleGetMediaMetadata", () => {
  it("returns error for empty path", async () => {
    const result = await handleGetMediaMetadata({ mediaFolderPath: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for whitespace-only path", async () => {
    const result = await handleGetMediaMetadata({ mediaFolderPath: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for null path", async () => {
    const result = await handleGetMediaMetadata({ mediaFolderPath: null as unknown as string });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for undefined path", async () => {
    const result = await handleGetMediaMetadata({ mediaFolderPath: undefined as unknown as string });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });
});
