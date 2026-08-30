import { describe, expect, it } from "vitest";
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import { buildTvShowRenameListForPlan } from "./buildTvShowRenameListForPlan";

describe("buildTvShowRenameListForPlan", () => {
  it("includes video and same-stem subtitle", () => {
    const plan: RenameFilesPlan = {
      id: "p1",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/m/Show",
      files: [
        {
          from: "/m/Show/S01E01.mkv",
          to: "/m/Show/Season 01/Show - S01E01 - Ep1.mkv",
        },
      ],
    };
    const localFiles = [
      "/m/Show/S01E01.mkv",
      "/m/Show/S01E01.sc.ass",
      "/m/Show/other.mkv",
    ];
    const list = buildTvShowRenameListForPlan({
      mediaFolderPath: "/m/Show",
      localFiles,
      plan,
    });
    expect(list[0]).toEqual(plan.files[0]);
    expect(list).toContainEqual({
      from: "/m/Show/S01E01.sc.ass",
      to: "/m/Show/Season 01/Show - S01E01 - Ep1.sc.ass",
    });
  });
});
