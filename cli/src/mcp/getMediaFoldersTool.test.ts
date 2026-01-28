import { describe, it, expect, mock } from "bun:test";
import type { UserConfig } from "@core/types";

let mockGetUserConfig: () => Promise<UserConfig> = async () => ({
  applicationLanguage: "en",
  tmdb: { apiKey: "", host: "https://api.themoviedb.org/3" },
  folders: ["C:\\Media\\TV", "C:\\Media\\Movies"],
  selectedRenameRule: "Plex(TvShow/Anime)",
} as UserConfig);

mock.module("@/utils/config", () => ({
  getUserConfig: () => mockGetUserConfig(),
}));

const { handleGetMediaFolders } = await import("./getMediaFoldersTool");

describe("handleGetMediaFolders", () => {
  it("returns same paths when config has folders (4.1)", async () => {
    const paths = ["C:\\Media\\TV", "C:\\Media\\Movies"];
    mockGetUserConfig = async () =>
      ({
        applicationLanguage: "en",
        tmdb: { apiKey: "", host: "https://api.themoviedb.org/3" },
        folders: paths,
        selectedRenameRule: "Plex(TvShow/Anime)",
      }) as UserConfig;

    const result = await handleGetMediaFolders();

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(paths);
  });

  it("returns empty list when config has no folders (4.2)", async () => {
    mockGetUserConfig = async () =>
      ({
        applicationLanguage: "en",
        tmdb: { apiKey: "", host: "https://api.themoviedb.org/3" },
        folders: [],
        selectedRenameRule: "Plex(TvShow/Anime)",
      }) as UserConfig;

    const result = await handleGetMediaFolders();

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(JSON.parse(result.content[0].text)).toEqual([]);
  });

  it("returns error when getUserConfig fails (4.3)", async () => {
    mockGetUserConfig = async () => {
      throw new Error("Config file not found");
    };

    const result = await handleGetMediaFolders();

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("Config file not found");
  });
});
