import { describe, it, expect, mock } from "bun:test";
import { handleGetEpisodes } from "./getEpisodesTool";

mock.module("node:fs/promises", () => ({
  stat: () => mock(),
}));

mock.module("@core/path", () => ({
  Path: {
    toPlatformPath: (path: string) => path,
    posix: (path: string) => path,
  },
}));

mock.module("@/utils/mediaMetadata", () => ({
  findMediaMetadata: () => mock(),
}));

describe("handleGetEpisodes", () => {
  it("returns error for invalid path parameter", async () => {
    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");
    
    const result = await reimportedHandler({ mediaFolderPath: "" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for whitespace-only path", async () => {
    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");
    
    const result = await reimportedHandler({ mediaFolderPath: "   " });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for undefined path", async () => {
    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");
    
    const result = await reimportedHandler({ mediaFolderPath: undefined as any });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error when folder does not exist", async () => {
    const mockStatError = new Error("ENOENT") as NodeJS.ErrnoException;
    mockStatError.code = "ENOENT";

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.reject(mockStatError),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/nonexistent/folder" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("failure");
    expect(parsed.message).toContain("Folder Not Found");
  });

  it("returns error when path is a file", async () => {
    const mockStat = {
      isDirectory: () => false,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/path/to/file.txt" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("failure");
    expect(parsed.message).toContain("Folder Not Found");
    expect(parsed.message).toContain("is not a directory");
  });

  it("returns error when no metadata found", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(null),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("failure");
    expect(parsed.message).toBe("SMM don't know the TV show info");
  });

  it("returns error when metadata has no tmdbTvShow", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const mockMetadata = {
      tmdbTvShow: null,
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("failure");
    expect(parsed.message).toBe("SMM don't know the TV show info");
  });

  it("returns error when tmdbTvShow has no id or seasons", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const mockMetadata = {
      tmdbTvShow: {
        id: 123,
        seasons: null,
      },
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("failure");
    expect(parsed.message).toBe("SMM don't know the TV show info");
  });

  it("returns success with episodes when metadata is valid", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const mockMetadata = {
      tmdbTvShow: {
        id: 123,
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: "Pilot" },
              { episode_number: 2, name: "Second Episode" },
            ],
          },
          {
            season_number: 2,
            episodes: [
              { episode_number: 1, name: "Season 2 Premiere" },
              { episode_number: 2 },
            ],
          },
        ],
      },
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.count).toBe(4);
    expect(parsed.episodes).toHaveLength(4);
    
    // Check first season episodes
    expect(parsed.episodes[0]).toEqual({
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Pilot",
    });
    expect(parsed.episodes[1]).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      title: "Second Episode",
    });
    
    // Check second season episodes
    expect(parsed.episodes[2]).toEqual({
      seasonNumber: 2,
      episodeNumber: 1,
      title: "Season 2 Premiere",
    });
    expect(parsed.episodes[3]).toEqual({
      seasonNumber: 2,
      episodeNumber: 2,
      title: "Episode 2",
    });
  });

  it("handles empty seasons array", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const mockMetadata = {
      tmdbTvShow: {
        id: 123,
        seasons: [],
      },
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.count).toBe(0);
    expect(parsed.episodes).toHaveLength(0);
  });

  it("handles season without episodes", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const mockMetadata = {
      tmdbTvShow: {
        id: 123,
        seasons: [
          {
            season_number: 1,
            episodes: null,
          },
        ],
      },
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/tvshow" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.count).toBe(0);
    expect(parsed.episodes).toHaveLength(0);
  });

  it("handles unexpected errors gracefully", async () => {
    mock.module("node:fs/promises", () => ({
      stat: () => Promise.reject(new Error("Unexpected error")),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodesTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/folder" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting episodes: Unexpected error");
  });
});