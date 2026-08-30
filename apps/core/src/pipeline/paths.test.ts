import { describe, expect, it } from "vitest";
import { basename, dirname, extname, joinPosix, metadataCachePath, userConfigPath } from "./paths";

describe("paths", () => {
  it("basename returns the last path segment", () => {
    expect(basename("/C:/media/My.Show/S01E01.mkv")).toBe("S01E01.mkv");
    expect(basename("no-separator")).toBe("no-separator");
  });

  it("dirname returns the parent path segment", () => {
    expect(dirname("/media/My.Show/S01E01.mkv")).toBe("/media/My.Show");
    expect(dirname("/media/My.Show")).toBe("/media");
    expect(dirname("/foo")).toBe("/");
  });

  it("extname returns the extension with leading dot", () => {
    expect(extname("/C:/media/a.mkv")).toBe(".mkv");
    expect(extname("noext")).toBe("");
  });

  it("joinPosix joins with forward slashes", () => {
    expect(joinPosix("/data/smm", "metadata", "x.json")).toBe("/data/smm/metadata/x.json");
  });

  it("userConfigPath points at <appDataDir>/smm.json", () => {
    expect(userConfigPath("/data/smm")).toBe("/data/smm/smm.json");
  });

  it("metadataCachePath sanitizes the folder path into a cache filename", () => {
    expect(metadataCachePath("/data/smm", "/C:/media/My Show")).toBe(
      "/data/smm/metadata/_C__media_My Show.json",
    );
  });
});
