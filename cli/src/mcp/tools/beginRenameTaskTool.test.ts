import { describe, it, expect, mock } from "bun:test";
import { handleBeginRenameTask, handleAddRenameEpisodeVideoFile, handleEndRenameTask } from "./beginRenameTaskTool";

mock.module("@core/path", () => ({
  Path: {
    toPlatformPath: (path: string) => path,
    posix: (path: string) => path,
  },
}));

mock.module("@/tools/renameFilesToolV2", () => ({
  beginRenameFilesTaskV2: () => mock(),
  addRenameFileToTaskV2: () => mock(),
  endRenameFilesTaskV2: () => mock(),
  getRenameTask: () => mock(),
}));

describe("handleBeginRenameTask", () => {
  it("returns error for invalid mediaFolderPath", async () => {
    const { handleBeginRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ mediaFolderPath: "" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("returns error for whitespace-only mediaFolderPath", async () => {
    const { handleBeginRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ mediaFolderPath: "   " });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("returns error for undefined mediaFolderPath", async () => {
    const { handleBeginRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ mediaFolderPath: undefined as any });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: mediaFolderPath must be a non-empty string");
  });

  it("successfully begins rename task", async () => {
    const taskId = "test-task-id-123";
    const mediaFolderPath = "/test/media/folder";

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve(taskId),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(undefined),
    }));

    const { handleBeginRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ mediaFolderPath });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe(taskId);
    expect(parsed.mediaFolderPath).toBe(mediaFolderPath);
  });

  it("handles errors when beginning task", async () => {
    const errorMessage = "Failed to create task";

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.reject(new Error(errorMessage)),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(undefined),
    }));

    const { handleBeginRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ mediaFolderPath: "/test/folder" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error starting rename task: ${errorMessage}`);
  });
});

describe("handleAddRenameFile", () => {
  it("returns error for invalid taskId", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "", from: "/source", to: "/dest" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for undefined taskId", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: undefined as any, from: "/source", to: "/dest" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for invalid 'from' parameter", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "valid-task-id", from: "", to: "/dest" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: 'from' must be a non-empty string");
  });

  it("returns error for undefined 'from' parameter", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "valid-task-id", from: undefined as any, to: "/dest" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: 'from' must be a non-empty string");
  });

  it("returns error for invalid 'to' parameter", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "valid-task-id", from: "/source", to: "" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: 'to' must be a non-empty string");
  });

  it("returns error for undefined 'to' parameter", async () => {
    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "valid-task-id", from: "/source", to: undefined as any });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid path: 'to' must be a non-empty string");
  });

  it("successfully adds rename file to task", async () => {
    const taskId = "test-task-id-123";

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve(taskId),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(undefined),
    }));

    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ 
      taskId, 
      from: "/source/file.txt", 
      to: "/dest/new-name.txt" 
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe(taskId);
  });

  it("handles errors when adding file to task", async () => {
    const errorMessage = "Task not found";

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve("task-id"),
      addRenameFileToTaskV2: () => Promise.reject(new Error(errorMessage)),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(undefined),
    }));

    const { handleAddRenameEpisodeVideoFile: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ 
      taskId: "nonexistent-task", 
      from: "/source", 
      to: "/dest" 
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error adding rename file: ${errorMessage}`);
  });
});

describe("handleEndRenameTask", () => {
  it("returns error for invalid taskId", async () => {
    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: "" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error for undefined taskId", async () => {
    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");
    
    const result = await reimportedHandler({ taskId: undefined as any });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid taskId: must be a non-empty string");
  });

  it("returns error when task is not found", async () => {
    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve("task-id"),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(undefined),
    }));

    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ taskId: "nonexistent-task" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("Task not found");
  });

  it("returns error when task has no files", async () => {
    const mockTask = {
      id: "plan-id",
      task: "rename-files",
      status: "pending",
      mediaFolderPath: "/test/folder",
      files: [],
    };

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve("task-id"),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(mockTask),
    }));

    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("No files in task");
  });

  it("successfully ends rename task with files", async () => {
    const mockTask = {
      id: "plan-id",
      task: "rename-files",
      status: "pending",
      mediaFolderPath: "/test/folder",
      files: [
        { from: "/source/file1.txt", to: "/dest/file1.txt" },
        { from: "/source/file2.txt", to: "/dest/file2.txt" },
      ],
    };

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve("task-id"),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.resolve(),
      getRenameTask: () => Promise.resolve(mockTask),
    }));

    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.taskId).toBe("task-id");
    expect(parsed.fileCount).toBe(2);
  });

  it("handles errors when ending task", async () => {
    const errorMessage = "Failed to end task";

    mock.module("@/tools/renameFilesToolV2", () => ({
      beginRenameFilesTaskV2: () => Promise.resolve("task-id"),
      addRenameFileToTaskV2: () => Promise.resolve(),
      endRenameFilesTaskV2: () => Promise.reject(new Error(errorMessage)),
      getRenameTask: () => Promise.resolve({
        id: "plan-id",
        task: "rename-files",
        status: "pending",
        mediaFolderPath: "/test/folder",
        files: [{ from: "/source", to: "/dest" }],
      }),
    }));

    const { handleEndRenameTask: reimportedHandler } = await import("./beginRenameTaskTool");

    const result = await reimportedHandler({ taskId: "task-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Error ending rename task: ${errorMessage}`);
  });
});