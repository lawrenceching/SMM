import { describe, it, expect, mock } from "bun:test";
import { handleListFiles } from "./listFilesTool";

describe("handleListFiles", () => {
  it("returns file list for valid folder", async () => {
    const mockFiles = ["/test/folder/file1.mp4", "/test/folder/file2.mkv"];

    mock.module("@/utils/files", () => ({
      listFiles: () => Promise.resolve(mockFiles),
    }));

    const { handleListFiles: reimportedHandler } = await import("./listFilesTool");

    const result = await reimportedHandler({ path: "/test/folder" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.files).toEqual(mockFiles);
    expect(parsed.count).toBe(2);
  });

  it("returns empty list for empty folder", async () => {
    mock.module("@/utils/files", () => ({
      listFiles: () => Promise.resolve([]),
    }));

    const { handleListFiles: reimportedHandler } = await import("./listFilesTool");

    const result = await reimportedHandler({ path: "/empty/folder" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.files).toEqual([]);
    expect(parsed.count).toBe(0);
  });

  it("returns error for empty path", async () => {
    const { handleListFiles } = await import("./listFilesTool");

    const result = await handleListFiles({ path: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for whitespace-only path", async () => {
    const { handleListFiles } = await import("./listFilesTool");

    const result = await handleListFiles({ path: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });
});
