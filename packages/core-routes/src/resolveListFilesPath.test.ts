import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  joinListFilesChildPath,
  normalizeListFilesInputPath,
  resolveListFilesAbsolutePath,
} from "../src/resolveListFilesPath.ts";

describe("resolveListFilesAbsolutePath", () => {
  it("preserves HarmonyOS file://docs URIs", () => {
    const uri = "file://docs/storage/Users/currentUser/Media/TV";
    expect(resolveListFilesAbsolutePath(uri)).toBe(uri);
  });

  it("resolves regular filesystem paths", () => {
    const resolved = resolveListFilesAbsolutePath("/tmp/example");
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toContain("example");
  });
});

describe("normalizeListFilesInputPath", () => {
  it("preserves file:// URIs unchanged", () => {
    const uri = "file://docs/storage/media";
    expect(normalizeListFilesInputPath(uri)).toBe(uri);
  });
});

describe("joinListFilesChildPath", () => {
  it("appends child segments to file:// URIs without path.join corruption", () => {
    expect(
      joinListFilesChildPath(
        "file://docs/storage/Media",
        "Season 1",
      ),
    ).toBe("file://docs/storage/Media/Season 1");
  });

  it("uses path.join for regular directories", () => {
    expect(joinListFilesChildPath("/tmp/media", "Season 1")).toBe(
      path.join("/tmp/media", "Season 1"),
    );
  });
});
