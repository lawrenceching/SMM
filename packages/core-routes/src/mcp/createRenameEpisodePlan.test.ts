import { describe, expect, it, vi } from "vitest";
import type { UserConfig } from "@smm/types";
import { CREATE_RENAME_EPISODE_PLAN } from "@smm/types/ai-tools/createRenameEpisodePlan";
import { END_PLAN_TASK_SUCCESS_MESSAGE } from "@smm/types/ai-tools/planTaskMessages";
import { RenameFilesPlanReady } from "@smm/types/event-types";
import type { ChatFs } from "../chatTypes.ts";
import { createMcpStreamableHttpHandler } from "./createServer.ts";

async function callMcp(
  handler: Awaited<ReturnType<typeof createMcpStreamableHttpHandler>>,
  id: number,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await handler(
    new Request("http://localhost/mcp/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  const text = await response.text();
  const data = response.headers.get("content-type")?.includes("application/json")
    ? text
    : (text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .at(-1)
        ?.slice("data:".length)
        .trim() ?? "");
  return JSON.parse(data) as Record<string, unknown>;
}

async function initialize(
  handler: Awaited<ReturnType<typeof createMcpStreamableHttpHandler>>,
): Promise<void> {
  await callMcp(handler, 1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.1" },
  });
}

function createMockFs(folder: string): ChatFs & {
  values: Map<string, unknown>;
} {
  const metadata = {
    mediaFolderPath: folder,
    type: "tvshow-folder",
    mediaFiles: [
      {
        absolutePath: `${folder}/S01E01.mkv`,
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ],
  };
  const values = new Map<string, unknown>();
  return {
    values,
    async readJson<T = unknown>(path: string): Promise<T | null> {
      return (
        path.includes("/metadata/") ? metadata : (values.get(path) ?? null)
      ) as T | null;
    },
    writeJson: vi.fn(async (path: string, value: unknown) => {
      values.set(path, value);
    }),
    exists: vi.fn(async (path: string) => path === `${folder}/S01E01.mkv`),
  };
}

const userConfig = {
  folders: [],
} as unknown as UserConfig;

describe(CREATE_RENAME_EPISODE_PLAN, () => {
  it("creates a pending plan, broadcasts readiness, and returns its plan id", async () => {
    const folder = "/media/show";
    const fs = createMockFs(folder);
    const broadcast = vi.fn();
    const handler = await createMcpStreamableHttpHandler({
      appDataDir: "/app-data",
      userDataDir: "/user-data",
      getUserConfig: async () => userConfig,
      fs,
      broadcast,
    });
    await initialize(handler);

    const response = await callMcp(handler, 2, "tools/call", {
      name: CREATE_RENAME_EPISODE_PLAN,
      arguments: {
        mediaFolderPath: folder,
        files: [
          {
            from: `${folder}/S01E01.mkv`,
            to: `${folder}/Show - S01E01.mkv`,
          },
        ],
      },
    });
    const result = response.result as {
      structuredContent?: { message?: string; planId?: string };
    };

    expect(result.structuredContent?.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(result.structuredContent?.planId).toEqual(expect.any(String));
    expect([...fs.values.values()]).toContainEqual(
      expect.objectContaining({
        id: result.structuredContent?.planId,
        status: "pending",
        creator: "ai",
      }),
    );
    expect(broadcast).toHaveBeenCalledWith({
      event: RenameFilesPlanReady.event,
      data: {
        taskId: result.structuredContent?.planId,
        planFilePath: `/app-data/plans/${result.structuredContent?.planId}.plan.json`,
      },
    });
  });

  it("returns an MCP validation error for an empty files array", async () => {
    const folder = "/media/show";
    const handler = await createMcpStreamableHttpHandler({
      appDataDir: "/app-data",
      userDataDir: "/user-data",
      getUserConfig: async () => userConfig,
      fs: createMockFs(folder),
    });
    await initialize(handler);

    const response = await callMcp(handler, 2, "tools/call", {
      name: CREATE_RENAME_EPISODE_PLAN,
      arguments: { mediaFolderPath: folder, files: [] },
    });
    const result = response.result as { isError?: boolean; content?: unknown[] };

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
  });
});

describe("how-to-rename-episode-video-files", () => {
  it("instructs clients to submit one create-rename-episode-plan call", async () => {
    const handler = await createMcpStreamableHttpHandler({
      appDataDir: "/app-data",
      userDataDir: "/user-data",
      getUserConfig: async () => userConfig,
      fs: createMockFs("/media/show"),
    });
    await initialize(handler);

    const response = await callMcp(handler, 2, "tools/call", {
      name: "how-to-rename-episode-video-files",
      arguments: {},
    });
    const result = response.result as {
      structuredContent?: { text?: string };
    };
    const text = result.structuredContent?.text ?? "";

    expect(text).toContain(CREATE_RENAME_EPISODE_PLAN);
    expect(text).not.toContain("begin-rename-episode-video-file-task");
    expect(text).not.toContain("add-rename-episode-video-file-to-task");
    expect(text).not.toContain("end-rename-episode-video-file-task");
  });
});
