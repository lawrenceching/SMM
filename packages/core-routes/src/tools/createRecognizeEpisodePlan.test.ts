import { describe, expect, it, vi } from "vitest";
import { CREATE_RECOGNIZE_EPISODE_PLAN } from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import { AI_AGENT_PERMISSIONS, type UserConfig } from "@smm/types";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
  RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RecognizeMediaFilePlanReady,
} from "@smm/types/event-types";
import type { ChatFs } from "../chatTypes.ts";
import { buildCreateRecognizeEpisodePlanTool } from "./createRecognizeEpisodePlan.ts";

function createMockFs(folder: string): ChatFs {
  const values = new Map<string, unknown>();
  return {
    async readJson<T = unknown>(path: string): Promise<T | null> {
      return (values.get(path) ?? null) as T | null;
    },
    writeJson: vi.fn(async (path: string, value: unknown) => {
      values.set(path, value);
    }),
    exists: vi.fn(async (path: string) => path === `${folder}/S01E01.mkv`),
  };
}

const FILES = [{ season: 1, episode: 1, path: "/media/show/S01E01.mkv" }];

function grantedConfig(): UserConfig {
  return {
    aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
  } as unknown as UserConfig;
}

describe(`buildCreateRecognizeEpisodePlanTool (${CREATE_RECOGNIZE_EPISODE_PLAN})`, () => {
  it("pending flow: emits RecognizeMediaFilePlanReady and returns the success message", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(result.planId).toEqual(expect.any(String));
    expect(broadcast).toHaveBeenCalledWith({
      event: RecognizeMediaFilePlanReady.event,
      data: {
        taskId: result.planId,
        planFilePath: `/app-data/plans/${result.planId}.plan.json`,
      },
    });
  });

  it("auto-apply: granted permission + applier applies, emits mediaMetadataUpdated, no PlanReady", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => grantedConfig(),
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE);
    expect(applyRecognizeEpisodePlan).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith({
      event: MEDIA_METADATA_UPDATED_EVENT,
      data: { folderPath: "/media/show" },
    });
    expect(
      broadcast.mock.calls.some(
        (call) => call[0].event === RecognizeMediaFilePlanReady.event,
      ),
    ).toBe(false);
  });

  it("applier failure falls back to the pending flow", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => grantedConfig(),
        applyRecognizeEpisodePlan: vi.fn(async () => {
          throw new Error("disk locked");
        }),
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(
      broadcast.mock.calls.some(
        (call) => call[0].event === RecognizeMediaFilePlanReady.event,
      ),
    ).toBe(true);
  });

  it("no permission → pending flow", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => ({}) as UserConfig,
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(applyRecognizeEpisodePlan).not.toHaveBeenCalled();
  });

  it("absent deps → pending flow", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );
    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });
    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
  });

  it("getUserConfig rejection → pending flow", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => {
          throw new Error("config unavailable");
        },
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(applyRecognizeEpisodePlan).not.toHaveBeenCalled();
  });

  it("validation failure returns an error payload and writes nothing", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: [
        { season: 1, episode: 1, path: "/media/show/S01E01.mkv" },
        { season: 1, episode: 1, path: "/media/show/S01E02.mkv" },
      ],
    });

    expect(result.error).toContain("Duplicate season/episode");
  });
});
