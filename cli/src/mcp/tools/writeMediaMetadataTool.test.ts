import { describe, it, expect, mock } from "bun:test";
import { handleWriteMediaMetadata } from "./writeMediaMetadataTool";
import type { MediaMetadata } from "@core/types";

describe("handleWriteMediaMetadata", () => {
  it("returns success when metadata is written successfully", async () => {
    const mockMetadata: MediaMetadata = {
      mediaFolderPath: "/test/folder",
      mediaName: "Test Show",
      tmdbTvShowId: 12345,
    };

    mock.module("@/route/mediaMetadata/utils", () => ({
      mediaMetadataDir: "/mock/metadata",
      metadataCacheFilePath: (path: string) => `/mock/metadata/${path.replace(/[\/\\:?*|<>"]/g, '_')}.json`,
    }));

    mock.module("bun", () => ({
      write: () => Promise.resolve(),
    }));

    const { handleWriteMediaMetadata: reimportedHandler } = await import("./writeMediaMetadataTool");

    const result = await reimportedHandler({ metadata: mockMetadata });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  });

  it("returns error when metadata is missing", async () => {
    const { handleWriteMediaMetadata } = await import("./writeMediaMetadataTool");

    const result = await handleWriteMediaMetadata({ metadata: null as unknown as MediaMetadata });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid request: metadata is required");
  });

  it("returns error when metadata is not an object", async () => {
    const { handleWriteMediaMetadata } = await import("./writeMediaMetadataTool");

    const result = await handleWriteMediaMetadata({ metadata: "not an object" as unknown as MediaMetadata });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid request: metadata is required");
  });

  it("returns error when mediaFolderPath is missing", async () => {
    const { handleWriteMediaMetadata } = await import("./writeMediaMetadataTool");

    const result = await handleWriteMediaMetadata({
      metadata: { mediaName: "Test" } as MediaMetadata,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid request: metadata.mediaFolderPath is required");
  });

  it("returns error when mediaFolderPath is empty string", async () => {
    const { handleWriteMediaMetadata } = await import("./writeMediaMetadataTool");

    const result = await handleWriteMediaMetadata({
      metadata: { mediaFolderPath: "", mediaName: "Test" } as MediaMetadata,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid request: metadata.mediaFolderPath is required");
  });

  it("handles filesystem errors gracefully", async () => {
    const mockMetadata: MediaMetadata = {
      mediaFolderPath: "/test/folder",
      mediaName: "Test Show",
    };

    mock.module("@/route/mediaMetadata/utils", () => ({
      mediaMetadataDir: "/mock/metadata",
      metadataCacheFilePath: (path: string) => `/mock/metadata/${path.replace(/[\/\\:?*|<>"]/g, '_')}.json`,
    }));

    mock.module("node:fs/promises", () => ({
      mkdir: () => Promise.reject(new Error("EACCES: permission denied")),
    }));

    const { handleWriteMediaMetadata: reimportedHandler } = await import("./writeMediaMetadataTool");

    const result = await reimportedHandler({ metadata: mockMetadata });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error writing media metadata");
  });

  it("normalizes path to POSIX format", async () => {
    const mockMetadata: MediaMetadata = {
      mediaFolderPath: "C:/Test/Folder",
      mediaName: "Test Show",
    };

    mock.module("@/route/mediaMetadata/utils", () => ({
      mediaMetadataDir: "/mock/metadata",
      metadataCacheFilePath: (path: string) => `/mock/metadata/${path.replace(/[\/\\:?*|<>"]/g, '_')}.json`,
    }));

    mock.module("node:fs/promises", () => ({
      mkdir: () => Promise.resolve(),
    }));

    mock.module("bun", () => ({
      write: () => Promise.resolve(),
    }));

    const { handleWriteMediaMetadata: reimportedHandler } = await import("./writeMediaMetadataTool");

    const result = await reimportedHandler({ metadata: mockMetadata });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.path).toContain("/");
  });
});
