import type { Plan } from "@/api/getPlans"
import { mediaFolderPathEqual } from "../TvShowPanelUtils"

type PlanTask = "rename-files" | "recognize-media-file"
type PlanCreator = "app" | "ai"

function selectActivePlanByCreator<T extends Plan>(
  plans: Plan[],
  mediaFolderPath: string | undefined,
  task: PlanTask,
  creator: PlanCreator,
): T | undefined {
  if (!mediaFolderPath) return undefined

  return plans.find(
    (p) =>
      p.task === task &&
      p.creator === creator &&
      (p.status === "pending" || p.status === "preparing") &&
      mediaFolderPathEqual(p.mediaFolderPath, mediaFolderPath),
  ) as T | undefined
}

/**
 * Active (`preparing` / `pending`) rule-based plan for a media folder.
 * Prompt visibility and preview mode both derive from this — no separate
 * Zustand `isOpen` sync required.
 */
export function selectActiveAppPlan<T extends Plan>(
  plans: Plan[],
  mediaFolderPath: string | undefined,
  task: PlanTask,
): T | undefined {
  return selectActivePlanByCreator(plans, mediaFolderPath, task, "app")
}

/**
 * Active (`preparing` / `pending`) AI/MCP-created plan for a media folder.
 * Used by AI rename/recognize flows; preview mode and prompt visibility
 * derive from the returned plan the same way as rule-based plans.
 */
export function selectActiveAiPlan<T extends Plan>(
  plans: Plan[],
  mediaFolderPath: string | undefined,
  task: PlanTask,
): T | undefined {
  return selectActivePlanByCreator(plans, mediaFolderPath, task, "ai")
}
