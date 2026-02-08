import { describe, it, expect, mock } from "bun:test";
import { handleGetEpisode } from "./getEpisode";

// Mock the Path module to test platform-specific path conversion
mock.module("@core/path", () => ({
  Path: {
    posix: (path: string) => path,
    toPlatformPath: (path: string) => {
      // Simulate Windows path conversion (POSIX to Windows)
      if (path.startsWith("/")) {
        return "C:" + path.replace(/\//g, "\\");
      }
      return path;
    },
  },
}));

describe("handleGetEpisode", () => {
  it("converts POSIX path to platform-specific format in response", async () => {
    const mockMetadata = {
      mediaFiles: [
        {
          seasonNumber: 1,
          episodeNumber: 5,
          absolutePath: "/media/test-show/S01E05.mkv",
        },
      ],
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisode: reimportedHandler } = await import("./getEpisode");

    const result = await reimportedHandler({
      mediaFolderPath: "/media/test-show",
      season: 1,
      episode: 5,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      season: number;
      episode: number;
      message: string;
    };

    // Verify path was converted from POSIX to platform-specific format (simulated Windows)
    expect(content.videoFilePath).toBe("C:\\media\\test-show\\S01E05.mkv");

    // Verify path is NOT in POSIX format
    expect(content.videoFilePath).not.toContain("/");

    // Verify other fields
    expect(content.season).toBe(1);
    expect(content.episode).toBe(5);
    expect(content.message).toBe("succeeded");
  });

  it("returns error for empty media folder path", async () => {
    const result = await handleGetEpisode({
      mediaFolderPath: "",
      season: 1,
      episode: 5,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.message).toContain("Invalid path");
  });

  it("returns error for invalid season number", async () => {
    const result = await handleGetEpisode({
      mediaFolderPath: "/media/test-show",
      season: -1,
      episode: 5,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.message).toContain("Invalid season");
  });

  it("returns error for invalid episode number", async () => {
    const result = await handleGetEpisode({
      mediaFolderPath: "/media/test-show",
      season: 1,
      episode: -1,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.message).toContain("Invalid episode");
  });

  it("returns empty path when metadata not found", async () => {
    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(undefined),
    }));

    const { handleGetEpisode: reimportedHandler } = await import("./getEpisode");

    const result = await reimportedHandler({
      mediaFolderPath: "/nonexistent/folder",
      season: 1,
      episode: 5,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.message).toContain("Media metadata not found");
  });

  it("returns empty path when no media files found", async () => {
    const mockMetadata = {
      mediaFiles: [],
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisode: reimportedHandler } = await import("./getEpisode");

    const result = await reimportedHandler({
      mediaFolderPath: "/media/test-show",
      season: 1,
      episode: 5,
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.message).toContain("No media files found");
  });

  it("returns empty path when episode not found", async () => {
    const mockMetadata = {
      mediaFiles: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          absolutePath: "/media/test-show/S01E01.mkv",
        },
      ],
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisode: reimportedHandler } = await import("./getEpisode");

    const result = await reimportedHandler({
      mediaFolderPath: "/media/test-show",
      season: 1,
      episode: 5, // Episode 5 doesn't exist
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      videoFilePath: string;
      season: number;
      episode: number;
      message: string;
    };

    expect(content.videoFilePath).toBe("");
    expect(content.season).toBe(1);
    expect(content.episode).toBe(5);
    expect(content.message).toContain("Episode S1E5 not found");
  });
});
