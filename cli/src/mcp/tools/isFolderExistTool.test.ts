import { describe, it, expect, mock } from "bun:test";
import { handleIsFolderExist } from "./isFolderExistTool";

mock.module("node:fs/promises", () => ({
  stat: () => mock(),
}));

describe("handleIsFolderExist", () => {
  it("returns exists: true when folder exists", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    // Re-import after mocking
    const { handleIsFolderExist: reimportedHandler } = await import("./isFolderExistTool");

    const result = await reimportedHandler({ path: "/test/folder" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.exists).toBe(true);
  });

  it("returns exists: false when path is a file", async () => {
    const mockStat = {
      isDirectory: () => false,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
    }));

    const { handleIsFolderExist: reimportedHandler } = await import("./isFolderExistTool");

    const result = await reimportedHandler({ path: "/test/file.txt" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.exists).toBe(false);
    expect(parsed.reason).toBe("Path exists but is not a directory");
  });

  it("returns error for empty path", async () => {
    const { handleIsFolderExist } = await import("./isFolderExistTool");

    const result = await handleIsFolderExist({ path: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });

  it("returns error for whitespace-only path", async () => {
    const { handleIsFolderExist } = await import("./isFolderExistTool");

    const result = await handleIsFolderExist({ path: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path");
  });
});
