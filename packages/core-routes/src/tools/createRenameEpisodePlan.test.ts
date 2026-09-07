import { describe, expect, it, vi } from "vitest";
import { CREATE_RENAME_EPISODE_PLAN } from "@smm/types/ai-tools/createRenameEpisodePlan";
import { AI_AGENT_PERMISSIONS, type UserConfig } from "@smm/types";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RenameFilesPlanReady,
} from "@smm/types/event-types";
import type { ChatFs } from "../chatTypes.ts";
import * as broadcastModule from "./broadcast.ts";
import { buildCreateRenameEpisodePlanTool } from "./createRenameEpisodePlan.ts";

function createMockFs(folder: string): ChatFs {
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

describe(`buildCreateRenameEpisodePlanTool (${CREATE_RENAME_EPISODE_PLAN})`, () => {
  it("uses defaultBroadcast when no callback is injected", async () => {
    const folder = "/media/show";
    const emitSpy = vi.spyOn(broadcastModule, "defaultBroadcast");
    const tool = buildCreateRenameEpisodePlanTool(
      "/app-data",
      createMockFs(folder),
    );

    const result = await tool.execute({
      mediaFolderPath: folder,
      files: [
        {
          from: `${folder}/S01E01.mkv`,
          to: `${folder}/Show - S01E01.mkv`,
        },
      ],
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(result.planId).toEqual(expect.any(String));
    expect(emitSpy).toHaveBeenCalledWith({
      event: RenameFilesPlanReady.event,
      data: {
        taskId: result.planId,
        planFilePath: `/app-data/plans/${result.planId}.plan.json`,
      },
    });

    emitSpy.mockRestore();
  });

  it("prefers injected broadcast over defaultBroadcast", async () => {
    const folder = "/media/show";
    const broadcast = vi.fn();
    const emitSpy = vi.spyOn(broadcastModule, "defaultBroadcast");
    const tool = buildCreateRenameEpisodePlanTool(
      "/app-data",
      createMockFs(folder),
      broadcast,
    );

    const result = await tool.execute({
      mediaFolderPath: folder,
      files: [
        {
          from: `${folder}/S01E01.mkv`,
          to: `${folder}/Show - S01E01.mkv`,
        },
      ],
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.planId).toEqual(expect.any(String));
    expect(broadcast).toHaveBeenCalledWith({
      event: RenameFilesPlanReady.event,
      data: {
        taskId: result.planId,
        planFilePath: `/app-data/plans/${result.planId}.plan.json`,
      },
    });
    expect(emitSpy).not.toHaveBeenCalled();

    emitSpy.mockRestore();
  });

  describe("auto-apply (metadata.write)", () => {
    const folder = "/media/show";
    const args = {
      mediaFolderPath: folder,
      files: [
        {
          from: `${folder}/S01E01.mkv`,
          to: `${folder}/Show - S01E01.mkv`,
        },
      ],
    };

    function grantedConfig(): UserConfig {
      return {
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      } as unknown as UserConfig;
    }

    function expectPendingPlanId(result: object): { planId: string } {
      if (!("planId" in result)) {
        throw new Error((result as { error: string }).error);
      }
      return result as { planId: string };
    }

    it("applies the plan and reports auto-apply when permission is granted", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => grantedConfig(),
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).toHaveBeenCalledTimes(1);
      expect(broadcast).toHaveBeenCalledWith({
        event: MEDIA_METADATA_UPDATED_EVENT,
        data: { folderPath: folder },
      });
      expect(broadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });

    it("falls back to a pending plan when the apply runner fails", async () => {
      const broadcast = vi.fn();
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => grantedConfig(),
          applyRenameEpisodePlan: vi.fn(async () => {
            throw new Error("EBUSY: resource busy");
          }),
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(broadcast).toHaveBeenCalledWith({
        event: RenameFilesPlanReady.event,
        data: {
          taskId: result.planId,
          planFilePath: `/app-data/plans/${result.planId}.plan.json`,
        },
      });
    });

    it("keeps the plan pending when the permission is not granted", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () =>
            ({ aiAgent: { permissions: [] } }) as unknown as UserConfig,
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).not.toHaveBeenCalled();
      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });

    it("keeps the plan pending when reading user config fails", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => {
            throw new Error("config read failed");
          },
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).not.toHaveBeenCalled();
      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });
  });
});
