import { describe, it, expect, mock } from "bun:test";
import { handleBeginRecognizeTask, handleAddRecognizedFile, handleEndRecognizeTask } from "./beginRecognizeTaskTool";

mock.module("@core/path", () => ({
  Path: {
    toPlatformPath: (path: string) => path,
    posix: (path: string) => path,
  },
}));

mock.module("@/tools/recognizeMediaFilesTool", () => ({
  beginRecognizeTask: () => mock(),
  addRecognizedMediaFile: () => mock(),
  endRecognizeTask: () => mock(),
  getTask: () => mock(),
}));

describe("handleBeginRecognizeTask", () => {
  it("returns error for invalid mediaFolderPath", async () => {
    const { handleBeginRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ mediaFolderPath: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("returns error for whitespace-only mediaFolderPath", async () => {
    const { handleBeginRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ mediaFolderPath: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("returns error for undefined mediaFolderPath", async () => {
    const { handleBeginRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ mediaFolderPath: undefined as any });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("successfully begins recognize task", async () => {
    const taskId = "test-task-id-123";
    const mediaFolderPath = "/test/media/folder";

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve(taskId),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(undefined),
    }));

    const { handleBeginRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ mediaFolderPath });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe(taskId);
    expect(parsed.mediaFolderPath).toBe(mediaFolderPath);
  });

  it("handles errors when beginning task", async () => {
    const errorMessage = "Failed to create task";

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.reject(new Error(errorMessage)),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(undefined),
    }));

    const { handleBeginRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/folder" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error starting recognize task: ${errorMessage}`);
  });
});

describe("handleAddRecognizedFile", () => {
  it("returns error for invalid taskId", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "", season: 1, episode: 5, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for undefined taskId", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: undefined as any, season: 1, episode: 5, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for invalid season", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: -1, episode: 5, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid season: must be a non-negative number");
  });

  it("returns error for undefined season", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: undefined as any, episode: 5, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid season: must be a non-negative number");
  });

  it("returns error for invalid episode", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: 1, episode: -1, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid episode: must be a non-negative number");
  });

  it("returns error for undefined episode", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: 1, episode: undefined as any, path: "/path/to/file.mp4" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid episode: must be a non-negative number");
  });

  it("returns error for invalid path", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: 1, episode: 5, path: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: must be a non-empty string");
  });

  it("returns error for undefined path", async () => {
    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "valid-task-id", season: 1, episode: 5, path: undefined as any });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: must be a non-empty string");
  });

  it("successfully adds recognized file to task", async () => {
    const taskId = "test-task-id-123";

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve(taskId),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(undefined),
    }));

    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({
      taskId,
      season: 1,
      episode: 5,
      path: "/path/to/file.mp4",
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe(taskId);
  });

  it("handles errors when adding file to task", async () => {
    const errorMessage = "Task not found";

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve("task-id"),
      addRecognizedMediaFile: () => Promise.reject(new Error(errorMessage)),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(undefined),
    }));

    const { handleAddRecognizedFile: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({
      taskId: "nonexistent-task",
      season: 1,
      episode: 5,
      path: "/path/to/file.mp4",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error adding recognized file: ${errorMessage}`);
  });
});

describe("handleEndRecognizeTask", () => {
  it("returns error for invalid taskId", async () => {
    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for undefined taskId", async () => {
    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: undefined as any });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error when task is not found", async () => {
    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve("task-id"),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(undefined),
    }));

    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "nonexistent-task" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("Task not found");
  });

  it("returns error when task has no recognized files", async () => {
    const mockTask = {
      id: "plan-id",
      task: "recognize-media-file",
      status: "pending",
      mediaFolderPath: "/test/folder",
      files: [],
    };

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve("task-id"),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(mockTask),
    }));

    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("No recognized files in task");
  });

  it("successfully ends recognize task with files", async () => {
    const mockTask = {
      id: "plan-id",
      task: "recognize-media-file",
      status: "pending",
      mediaFolderPath: "/test/folder",
      files: [
        { season: 1, episode: 1, path: "/source/file1.mkv" },
        { season: 1, episode: 2, path: "/source/file2.mkv" },
      ],
    };

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve("task-id"),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.resolve(),
      getTask: () => Promise.resolve(mockTask),
    }));

    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe("task-id");
    expect(parsed.fileCount).toBe(2);
  });

  it("handles errors when ending task", async () => {
    const errorMessage = "Failed to end task";

    mock.module("@/tools/recognizeMediaFilesTool", () => ({
      beginRecognizeTask: () => Promise.resolve("task-id"),
      addRecognizedMediaFile: () => Promise.resolve(),
      endRecognizeTask: () => Promise.reject(new Error(errorMessage)),
      getTask: () => Promise.resolve({
        id: "plan-id",
        task: "recognize-media-file",
        status: "pending",
        mediaFolderPath: "/test/folder",
        files: [{ season: 1, episode: 1, path: "/source/file.mkv" }],
      }),
    }));

    const { handleEndRecognizeTask: reimportedHandler } = await import("./beginRecognizeTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error ending recognize task: ${errorMessage}`);
  });
});
