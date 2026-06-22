import { describe, expect, it } from "vitest"
import { selectActiveAiPlan, selectActiveAppPlan } from "./selectActiveAppPlan"
import type { Plan } from "@/api/getPlans"

describe("selectActiveAppPlan", () => {
  const plans: Plan[] = [
    {
      id: "rename-1",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/media/show",
      files: [],
    },
    {
      id: "recognize-1",
      task: "recognize-media-file",
      status: "preparing",
      creator: "app",
      mediaFolderPath: "/media/show",
      files: [],
    },
    {
      id: "ai-recognize",
      task: "recognize-media-file",
      status: "pending",
      creator: "ai",
      mediaFolderPath: "/media/show",
      files: [],
    },
  ]

  it("returns active app plan for the given task and folder", () => {
    expect(
      selectActiveAppPlan(plans, "/media/show", "rename-files")?.id,
    ).toBe("rename-1")
    expect(
      selectActiveAppPlan(plans, "/media/show", "recognize-media-file")?.id,
    ).toBe("recognize-1")
  })

  it("ignores AI plans and terminal statuses", () => {
    expect(
      selectActiveAppPlan(
        [
          {
            id: "done",
            task: "rename-files",
            status: "completed",
            creator: "app",
            mediaFolderPath: "/media/show",
            files: [],
          },
        ],
        "/media/show",
        "rename-files",
      ),
    ).toBeUndefined()
  })
})

describe("selectActiveAiPlan", () => {
  const plans: Plan[] = [
    {
      id: "rename-app",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/media/show",
      files: [],
    },
    {
      id: "rename-ai",
      task: "rename-files",
      status: "pending",
      creator: "ai",
      mediaFolderPath: "/media/show",
      files: [{ from: "/a.mkv", to: "/b.mkv" }],
    },
  ]

  it("returns active AI plan for the given task and folder", () => {
    expect(
      selectActiveAiPlan(plans, "/media/show", "rename-files")?.id,
    ).toBe("rename-ai")
  })

  it("ignores app plans", () => {
    expect(
      selectActiveAiPlan(
        [
          {
            id: "rename-app",
            task: "rename-files",
            status: "pending",
            creator: "app",
            mediaFolderPath: "/media/show",
            files: [],
          },
        ],
        "/media/show",
        "rename-files",
      ),
    ).toBeUndefined()
  })

  it("returns active AI recognize plan", () => {
    expect(
      selectActiveAiPlan(
        [
          {
            id: "recognize-ai",
            task: "recognize-media-file",
            status: "pending",
            creator: "ai",
            mediaFolderPath: "/media/show",
            files: [{ season: 1, episode: 1, path: "/media/show/S01E01.mkv" }],
          },
        ],
        "/media/show",
        "recognize-media-file",
      )?.id,
    ).toBe("recognize-ai")
  })
})
