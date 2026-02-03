import { describe, it, expect, mock } from "bun:test";
import { handleRenameFolder } from "@/tools/renameFolder";

mock.module("node:fs/promises", () => ({
  stat: () => mock(),
  rename: () => mock(),
}));

mock.module("@core/path", () => ({
  Path: {
    toPlatformPath: (path: string) => path,
    posix: (path: string) => path,
  },
}));

mock.module("@/route/mediaMetadata/utils", () => ({
  metadataCacheFilePath: (path: string) => `${path}.metadata.json`,
}));

describe("handleRenameFolder", () => {
  it("returns error for invalid 'from' parameter", async () => {
    const result = await handleRenameFolder({ from: "", to: "/valid/path" });
    
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path: 'from' must be a non-empty string");
  });

  it("returns error for whitespace-only 'from' parameter", async () => {
    const result = await handleRenameFolder({ from: "   ", to: "/valid/path" });
    
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path: 'from' must be a non-empty string");
  });

  it("returns error for undefined 'from' parameter", async () => {
    const result = await handleRenameFolder({ from: undefined as any, to: "/valid/path" });
    
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path: 'from' must be a non-empty string");
  });

  it("returns error for invalid 'to' parameter", async () => {
    const result = await handleRenameFolder({ from: "/valid/path", to: "" });
    
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path: 'to' must be a non-empty string");
  });

  it("returns error for whitespace-only 'to' parameter", async () => {
    const result = await handleRenameFolder({ from: "/valid/path", to: "   " });
    
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path: 'to' must be a non-empty string");
  });

  it("returns error when source folder does not exist", async () => {
    const mockStatError = new Error("ENOENT") as NodeJS.ErrnoException;
    mockStatError.code = "ENOENT";

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.reject(mockStatError),
      rename: () => Promise.resolve(),
    }));

    const result = await handleRenameFolder({ from: "/nonexistent/folder", to: "/new/folder" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    expect(parsed.renamed).toBe(false);
    expect(parsed.error).toBe("Source folder not found");
  });

  it("returns error when source path is a file", async () => {
    const mockStat = {
      isDirectory: () => false,
    };

    mock.module("node:fs/promises", () => ({
      stat: () => Promise.resolve(mockStat),
      rename: () => Promise.resolve(),
    }));

    const result = await handleRenameFolder({ from: "/path/to/file.txt", to: "/new/path" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    expect(parsed.renamed).toBe(false);
    expect(parsed.error).toBe("Source path is not a directory");
  });

  it("returns error when destination folder already exists", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    const statMock = (path: string) => {
      if (path === "/existing/destination") {
        return Promise.resolve(mockStat);
      }
      return Promise.resolve(mockStat);
    };

    mock.module("node:fs/promises", () => ({
      stat: statMock,
      rename: () => Promise.resolve(),
    }));

    const result = await handleRenameFolder({ from: "/source/folder", to: "/existing/destination" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    expect(parsed.renamed).toBe(false);
    expect(parsed.error).toBe("Destination folder already exists");
  });

  it("successfully renames folder when no metadata cache exists", async () => {
    const mockStat = {
      isDirectory: () => true,
    };

    const statMock = (path: string) => {
      if (path === "/new/destination") {
        const error = new Error("ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        return Promise.reject(error);
      }
      return Promise.resolve(mockStat);
    };

    let renameCalled = false;
    let renameFrom = "";
    let renameTo = "";

    mock.module("node:fs/promises", () => ({
      stat: statMock,
      rename: (from: string, to: string) => {
        renameCalled = true;
        renameFrom = from;
        renameTo = to;
        return Promise.resolve();
      },
    }));

    // Mock Bun.file to return false for exists()
    const originalFile = Bun.file;
    const mockFile = {
      exists: () => Promise.resolve(false),
      json: () => Promise.resolve({}),
      unlink: () => Promise.resolve(),
    };
    
    // Temporarily override Bun.file for this test
    const tempBunFile = (path: string) => mockFile;
    (Bun as any).file = tempBunFile;

    const result = await handleRenameFolder({ from: "/source/folder", to: "/new/destination" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    expect(parsed.renamed).toBe(true);
    expect(parsed.from).toBe("/source/folder");
    expect(parsed.to).toBe("/new/destination");
    expect(renameCalled).toBe(true);
    expect(renameFrom).toBe("/source/folder");
    expect(renameTo).toBe("/new/destination");

    // Restore original Bun.file
    (Bun as any).file = originalFile;
  });

  it("handles unexpected errors during rename", async () => {
    mock.module("node:fs/promises", () => ({
      stat: () => Promise.reject(new Error("Unexpected error")),
      rename: () => Promise.resolve(),
    }));

    const result = await handleRenameFolder({ from: "/source/folder", to: "/new/destination" });

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Error renaming folder: Unexpected error");
  });
});
