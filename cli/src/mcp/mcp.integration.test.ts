import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm, stat, readdir } from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import tool handlers directly for integration testing
import { handleIsFolderExist } from "./tools/isFolderExistTool";
import { handleListFiles } from "./tools/listFilesTool";
import { handleGetMediaMetadata, handleWriteMediaMetadata, handleDeleteMediaMetadata } from "./tools";
import { handleBeginRecognizeTask, handleAddRecognizedFile, handleEndRecognizeTask } from "./tools/beginRecognizeTaskTool";
import { handleBeginRenameTask, handleAddRenameFile, handleEndRenameTask } from "./tools/beginRenameTaskTool";

describe("MCP Server Integration Tests", () => {
  let tempDir: string;
  let testMediaDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = path.join(os.tmpdir(), `smm-mcp-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    testMediaDir = path.join(tempDir, "TestShow");
    await mkdir(testMediaDir, { recursive: true });

    // Create some test files
    await writeFile(path.join(testMediaDir, "S01E01.mkv"), "test video content 1");
    await writeFile(path.join(testMediaDir, "S01E02.mkv"), "test video content 2");
    await writeFile(path.join(testMediaDir, "S02E01.mkv"), "test video content 3");
    await writeFile(path.join(testMediaDir, "poster.jpg"), "poster image");
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("8.1 MCP Server Startup - Tool Registration", () => {
    it("should have all file operation tools available", async () => {
      // Test that isFolderExist handler is properly exported
      expect(typeof handleIsFolderExist).toBe("function");

      // Test that listFiles handler is properly exported
      expect(typeof handleListFiles).toBe("function");
    });

    it("should have all media metadata tools available", async () => {
      // Test that metadata handlers are properly exported
      expect(typeof handleGetMediaMetadata).toBe("function");
      expect(typeof handleWriteMediaMetadata).toBe("function");
      expect(typeof handleDeleteMediaMetadata).toBe("function");
    });

    it("should have all recognize task tools available", async () => {
      // Test that recognize task handlers are properly exported
      expect(typeof handleBeginRecognizeTask).toBe("function");
      expect(typeof handleAddRecognizedFile).toBe("function");
      expect(typeof handleEndRecognizeTask).toBe("function");
    });

    it("should have all rename task tools available", async () => {
      // Test that rename task handlers are properly exported
      expect(typeof handleBeginRenameTask).toBe("function");
      expect(typeof handleAddRenameFile).toBe("function");
      expect(typeof handleEndRenameTask).toBe("function");
    });
  });

  describe("8.2 Tool Discovery - Handler Signatures", () => {
    it("isFolderExist tool should accept path parameter", async () => {
      const result = await handleIsFolderExist({ path: testMediaDir });
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("listFiles tool should accept path parameter", async () => {
      const result = await handleListFiles({ path: testMediaDir });
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("getMediaMetadata tool should accept mediaFolderPath parameter", async () => {
      const result = await handleGetMediaMetadata({ mediaFolderPath: testMediaDir });
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("writeMediaMetadata tool should accept metadata parameter", async () => {
      const metadata = {
        mediaFolderPath: testMediaDir,
        mediaName: "Test Show",
        type: "tvshow",
      };
      const result = await handleWriteMediaMetadata({ metadata });
      expect(result.content).toBeDefined();
    });

    it("deleteMediaMetadata tool should accept mediaFolderPath parameter", async () => {
      const result = await handleDeleteMediaMetadata({ mediaFolderPath: testMediaDir });
      expect(result.content).toBeDefined();
    });

    it("beginRecognizeTask tool should accept mediaFolderPath parameter", async () => {
      const result = await handleBeginRecognizeTask({ mediaFolderPath: testMediaDir });
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("addRecognizedFile tool should accept taskId, season, episode, path parameters", async () => {
      // First create a task
      const beginResult = await handleBeginRecognizeTask({ mediaFolderPath: testMediaDir });
      const beginParsed = JSON.parse(beginResult.content[0].text);
      expect(beginParsed.success).toBe(true);

      // Then add a file
      const result = await handleAddRecognizedFile({
        taskId: beginParsed.taskId,
        season: 1,
        episode: 1,
        path: path.join(testMediaDir, "S01E01.mkv"),
      });

      expect(result.content).toBeDefined();
    });

    it("endRecognizeTask tool should accept taskId parameter", async () => {
      // Create a task and add a file
      const beginResult = await handleBeginRecognizeTask({ mediaFolderPath: testMediaDir });
      const beginParsed = JSON.parse(beginResult.content[0].text);

      await handleAddRecognizedFile({
        taskId: beginParsed.taskId,
        season: 1,
        episode: 1,
        path: path.join(testMediaDir, "S01E01.mkv"),
      });

      // End the task
      const result = await handleEndRecognizeTask({ taskId: beginParsed.taskId });
      expect(result.content).toBeDefined();
    });

    it("beginRenameTask tool should accept mediaFolderPath parameter", async () => {
      const result = await handleBeginRenameTask({ mediaFolderPath: testMediaDir });
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("addRenameFile tool should accept taskId, from, to parameters", async () => {
      // First create a task
      const beginResult = await handleBeginRenameTask({ mediaFolderPath: testMediaDir });
      const beginParsed = JSON.parse(beginResult.content[0].text);

      // Add a rename operation
      const result = await handleAddRenameFile({
        taskId: beginParsed.taskId,
        from: path.join(testMediaDir, "S01E01.mkv"),
        to: path.join(testMediaDir, "Test Show - S01E01.mkv"),
      });

      expect(result.content).toBeDefined();
    });

    it("endRenameTask tool should accept taskId parameter", async () => {
      // Create a task and add a rename
      const beginResult = await handleBeginRenameTask({ mediaFolderPath: testMediaDir });
      const beginParsed = JSON.parse(beginResult.content[0].text);

      await handleAddRenameFile({
        taskId: beginParsed.taskId,
        from: path.join(testMediaDir, "S01E01.mkv"),
        to: path.join(testMediaDir, "Test Show - S01E01.mkv"),
      });

      // End the task
      const result = await handleEndRenameTask({ taskId: beginParsed.taskId });
      expect(result.content).toBeDefined();
    });
  });

  describe("8.3 File Operation Tools - Real File System", () => {
    it("isFolderExist should return exists:true for existing folder", async () => {
      const result = await handleIsFolderExist({ path: testMediaDir });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(true);
    });

    it("isFolderExist should return exists:false for non-existing folder", async () => {
      const result = await handleIsFolderExist({ path: path.join(tempDir, "nonexistent") });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(false);
    });

    it("isFolderExist should return error for file path", async () => {
      const filePath = path.join(testMediaDir, "S01E01.mkv");
      const result = await handleIsFolderExist({ path: filePath });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(false);
      expect(parsed.reason).toBe("Path exists but is not a directory");
    });

    it("listFiles should return all files in directory", async () => {
      const result = await handleListFiles({ folderPath: testMediaDir });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.files).toBeDefined();
      expect(parsed.count).toBe(4); // 3 mkv files + 1 jpg
    });

    it("listFiles should return empty array for empty directory", async () => {
      const emptyDir = path.join(tempDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      const result = await handleListFiles({ folderPath: emptyDir });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.files).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it("listFiles should return error for non-existing directory", async () => {
      const result = await handleListFiles({ folderPath: path.join(tempDir, "nonexistent") });

      // The tool may return error or isError flag
      expect(result.isError || result.content[0].text.includes("error") || result.content[0].text.includes("Error")).toBe(true);
    });
  });

  describe("8.4 Media Metadata Tools - Real Cache", () => {
    it("writeMediaMetadata should create metadata cache file", async () => {
      const metadata = {
        mediaFolderPath: testMediaDir,
        mediaName: "Test Show",
        type: "tvshow",
        tmdbTvShowId: 12345,
        tmdbTvShow: {
          id: 12345,
          name: "Test Show",
          poster_path: "/test.jpg",
          backdrop_path: "/backdrop.jpg",
        },
      };

      const result = await handleWriteMediaMetadata({ metadata });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it("getMediaMetadata should return cached metadata", async () => {
      // First write metadata
      const metadata = {
        mediaFolderPath: testMediaDir,
        mediaName: "Test Show",
        type: "tvshow",
        tmdbTvShowId: 12345,
      };

      await handleWriteMediaMetadata({ metadata });

      // Then retrieve it
      const result = await handleGetMediaMetadata({ mediaFolderPath: testMediaDir });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.found).toBe(true);
      expect(parsed.metadata.mediaName).toBe("Test Show");
      expect(parsed.metadata.tmdbTvShowId).toBe(12345);
    });

    it("getMediaMetadata should return error for non-existing metadata", async () => {
      const result = await handleGetMediaMetadata({ mediaFolderPath: path.join(tempDir, "nonexistent") });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.found).toBe(false);
    });

    it("deleteMediaMetadata should remove metadata cache", async () => {
      // First write metadata
      const metadata = {
        mediaFolderPath: testMediaDir,
        mediaName: "Test Show",
        type: "tvshow",
      };

      await handleWriteMediaMetadata({ metadata });

      // Then delete it
      const deleteResult = await handleDeleteMediaMetadata({ mediaFolderPath: testMediaDir });

      expect(deleteResult.isError).toBeUndefined();
      const parsed = JSON.parse(deleteResult.content[0].text);
      expect(parsed.deleted).toBe(true);
    });

    it("deleteMediaMetadata should return error for non-existing cache", async () => {
      const result = await handleDeleteMediaMetadata({ mediaFolderPath: path.join(tempDir, "nonexistent") });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deleted).toBe(false);
      expect(parsed.error).toBe("Metadata file not found");
    });
  });

  describe("8.5 Batch Operation Task Lifecycle", () => {
    describe("Recognize Task Lifecycle", () => {
      it("should complete full recognize task lifecycle", async () => {
        // Step 1: Begin recognize task
        const beginResult = await handleBeginRecognizeTask({ mediaFolderPath: testMediaDir });
        expect(beginResult.isError).toBeUndefined();
        const beginParsed = JSON.parse(beginResult.content[0].text);
        expect(beginParsed.success).toBe(true);
        expect(beginParsed.taskId).toBeDefined();

        const taskId = beginParsed.taskId;

        // Step 2: Add recognized files
        const addResult1 = await handleAddRecognizedFile({
          taskId,
          season: 1,
          episode: 1,
          path: path.join(testMediaDir, "S01E01.mkv"),
        });
        expect(addResult1.isError).toBeUndefined();

        const addResult2 = await handleAddRecognizedFile({
          taskId,
          season: 1,
          episode: 2,
          path: path.join(testMediaDir, "S01E02.mkv"),
        });
        expect(addResult2.isError).toBeUndefined();

        // Step 3: End recognize task
        const endResult = await handleEndRecognizeTask({ taskId });
        expect(endResult.isError).toBeUndefined();
        const endParsed = JSON.parse(endResult.content[0].text);
        expect(endParsed.success).toBe(true);
        expect(endParsed.fileCount).toBe(2);
      });

      it("should reject end task with no files", async () => {
        // Begin task without adding files
        const beginResult = await handleBeginRecognizeTask({ mediaFolderPath: testMediaDir });
        const beginParsed = JSON.parse(beginResult.content[0].text);

        // End task should fail
        const endResult = await handleEndRecognizeTask({ taskId: beginParsed.taskId });
        expect(endResult.isError).toBeUndefined();
        const endParsed = JSON.parse(endResult.content[0].text);
        expect(endParsed.success).toBe(false);
        expect(endParsed.error).toBe("No recognized files in task");
      });

      it("should reject task operations with invalid taskId", async () => {
        // Add file to non-existent task
        const addResult = await handleAddRecognizedFile({
          taskId: "invalid-task-id",
          season: 1,
          episode: 1,
          path: path.join(testMediaDir, "S01E01.mkv"),
        });
        expect(addResult.isError).toBe(true);
      });
    });

    describe("Rename Task Lifecycle", () => {
      it("should complete full rename task lifecycle", async () => {
        // Step 1: Begin rename task
        const beginResult = await handleBeginRenameTask({ mediaFolderPath: testMediaDir });
        expect(beginResult.isError).toBeUndefined();
        const beginParsed = JSON.parse(beginResult.content[0].text);
        expect(beginParsed.success).toBe(true);
        expect(beginParsed.taskId).toBeDefined();

        const taskId = beginParsed.taskId;

        // Step 2: Add rename operations
        const addResult1 = await handleAddRenameFile({
          taskId,
          from: path.join(testMediaDir, "S01E01.mkv"),
          to: path.join(testMediaDir, "Test Show - S01E01.mkv"),
        });
        expect(addResult1.isError).toBeUndefined();

        const addResult2 = await handleAddRenameFile({
          taskId,
          from: path.join(testMediaDir, "S01E02.mkv"),
          to: path.join(testMediaDir, "Test Show - S01E02.mkv"),
        });
        expect(addResult2.isError).toBeUndefined();

        // Step 3: End rename task
        const endResult = await handleEndRenameTask({ taskId });
        expect(endResult.isError).toBeUndefined();
        const endParsed = JSON.parse(endResult.content[0].text);
        expect(endParsed.success).toBe(true);
        expect(endParsed.fileCount).toBe(2);
      });

      it("should reject end task with no files", async () => {
        // Begin task without adding files
        const beginResult = await handleBeginRenameTask({ mediaFolderPath: testMediaDir });
        const beginParsed = JSON.parse(beginResult.content[0].text);

        // End task should fail
        const endResult = await handleEndRenameTask({ taskId: beginParsed.taskId });
        expect(endResult.isError).toBeUndefined();
        const endParsed = JSON.parse(endResult.content[0].text);
        expect(endParsed.success).toBe(false);
        expect(endParsed.error).toBe("No files in task");
      });

      it("should reject task operations with invalid taskId", async () => {
        // Add file to non-existent task
        const addResult = await handleAddRenameFile({
          taskId: "invalid-task-id",
          from: path.join(testMediaDir, "S01E01.mkv"),
          to: path.join(testMediaDir, "renamed.mkv"),
        });
        expect(addResult.isError).toBe(true);
      });
    });
  });

  describe("Input Validation", () => {
    it("should reject empty path for isFolderExist", async () => {
      const result = await handleIsFolderExist({ path: "" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid path");
    });

    it("should reject empty path for listFiles", async () => {
      const result = await handleListFiles({ path: "" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid path");
    });

    it("should reject empty mediaFolderPath for writeMediaMetadata", async () => {
      const result = await handleWriteMediaMetadata({
        metadata: { mediaFolderPath: "", mediaName: "Test" },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid request");
    });

    it("should reject missing metadata for writeMediaMetadata", async () => {
      const result = await handleWriteMediaMetadata({ metadata: null });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid request");
    });

    it("should reject empty taskId for addRecognizedFile", async () => {
      const result = await handleAddRecognizedFile({
        taskId: "",
        season: 1,
        episode: 1,
        path: "/path/to/file.mkv",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid taskId");
    });

    it("should reject negative season for addRecognizedFile", async () => {
      const result = await handleAddRecognizedFile({
        taskId: "valid-id",
        season: -1,
        episode: 1,
        path: "/path/to/file.mkv",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid season");
    });

    it("should reject empty taskId for endRecognizeTask", async () => {
      const result = await handleEndRecognizeTask({ taskId: "" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid taskId");
    });
  });
});
