import { describe, it, expect, mock } from "bun:test";
import { handleGetEpisodes } from "./getEpisodes";

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

describe("handleGetEpisodes", () => {
  it("converts POSIX paths to platform-specific format in response", async () => {
    const mockMetadata = {
      tmdbTvShow: {
        name: "Test TV Show",
        number_of_seasons: 2,
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: "Episode 1" },
              { episode_number: 2, name: "Episode 2" },
            ],
          },
        ],
      },
      mediaFiles: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          absolutePath: "/media/test-show/S01E01.mkv",
        },
        {
          seasonNumber: 1,
          episodeNumber: 2,
          absolutePath: "/media/test-show/S01E02.mkv",
        },
      ],
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodes");

    const result = await reimportedHandler({
      mediaFolderPath: "/media/test-show",
    });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      episodes: Array<{ season: number; episode: number; videoFilePath?: string }>;
      totalCount: number;
      showName: string;
      numberOfSeasons: number;
    };

    // Verify episodes are returned
    expect(content.episodes).toBeDefined();
    expect(content.episodes.length).toBe(2);

    // Verify paths were converted from POSIX to platform-specific format (simulated Windows)
    const firstEpisode = content.episodes.find((e) => e.episode === 1);
    expect(firstEpisode).toBeDefined();
    expect(firstEpisode?.videoFilePath).toBe("C:\\media\\test-show\\S01E01.mkv");

    const secondEpisode = content.episodes.find((e) => e.episode === 2);
    expect(secondEpisode).toBeDefined();
    expect(secondEpisode?.videoFilePath).toBe("C:\\media\\test-show\\S01E02.mkv");

    // Verify paths are NOT in POSIX format
    expect(firstEpisode?.videoFilePath).not.toContain("/");
    expect(secondEpisode?.videoFilePath).not.toContain("/");
  });

  it("returns error for empty media folder path", async () => {
    const result = await handleGetEpisodes({ mediaFolderPath: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for whitespace-only media folder path", async () => {
    const result = await handleGetEpisodes({ mediaFolderPath: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error when metadata not found", async () => {
    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(undefined),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodes");

    const result = await reimportedHandler({ mediaFolderPath: "/nonexistent/folder" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("TV show not found");
  });

  it("returns error when metadata is not a TV show", async () => {
    const mockMetadata = {
      tmdbTvShow: undefined,
      type: "movie",
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodes");

    const result = await reimportedHandler({ mediaFolderPath: "/media/movie" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Not a TV show folder");
  });

  it("handles episodes without recognized video files", async () => {
    const mockMetadata = {
      tmdbTvShow: {
        name: "Test TV Show",
        number_of_seasons: 1,
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: "Episode 1" },
              { episode_number: 2, name: "Episode 2" },
            ],
          },
        ],
      },
      mediaFiles: [], // No recognized files
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodes");

    const result = await reimportedHandler({ mediaFolderPath: "/media/test-show" });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      episodes: Array<{ season: number; episode: number; videoFilePath?: string }>;
    };

    // Verify episodes exist but without videoFilePath
    expect(content.episodes.length).toBe(2);
    expect(content.episodes[0].videoFilePath).toBeUndefined();
    expect(content.episodes[1].videoFilePath).toBeUndefined();
  });

  it("returns undefined videoFilePath for unrecognized episodes", async () => {
    const mockMetadata = {
      tmdbTvShow: {
        name: "Test TV Show",
        number_of_seasons: 1,
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: "Episode 1" },
              { episode_number: 2, name: "Episode 2" },
              { episode_number: 3, name: "Episode 3" },
            ],
          },
        ],
      },
      mediaFiles: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          absolutePath: "/media/test-show/S01E01.mkv",
        },
        // Episode 3 is recognized, but Episode 2 is not
        {
          seasonNumber: 1,
          episodeNumber: 3,
          absolutePath: "/media/test-show/S01E03.mkv",
        },
      ],
    };

    mock.module("@/utils/mediaMetadata", () => ({
      findMediaMetadata: () => Promise.resolve(mockMetadata),
    }));

    const { handleGetEpisodes: reimportedHandler } = await import("./getEpisodes");

    const result = await reimportedHandler({ mediaFolderPath: "/media/test-show" });

    expect(result.isError).toBeUndefined();
    const content = result.structuredContent as {
      episodes: Array<{ season: number; episode: number; videoFilePath?: string }>;
    };

    const episode1 = content.episodes.find((e) => e.episode === 1);
    const episode2 = content.episodes.find((e) => e.episode === 2);
    const episode3 = content.episodes.find((e) => e.episode === 3);

    // Episode 1 should have path (converted)
    expect(episode1?.videoFilePath).toBe("C:\\media\\test-show\\S01E01.mkv");
    // Episode 2 should not have path (not recognized)
    expect(episode2?.videoFilePath).toBeUndefined();
    // Episode 3 should have path (converted)
    expect(episode3?.videoFilePath).toBe("C:\\media\\test-show\\S01E03.mkv");
  });
});
