import type { Plan } from "@/api/getPlans"
import { mediaFolderPathEqual } from "@/components/TvShowPanelUtils"

type AppPlanTask = "rename-files" | "recognize-media-file"

/**
 * Active (`preparing` / `pending`) rule-based plan for a media folder.
 * Prompt visibility and preview mode both derive from this — no separate
 * Zustand `isOpen` sync required.
 */
export function selectActiveAppPlan<T extends Plan>(
  plans: Plan[],
  mediaFolderPath: string | undefined,
  task: AppPlanTask,
): T | undefined {
  if (!mediaFolderPath) return undefined

  return plans.find(
    (p) =>
      p.task === task &&
      p.creator === "app" &&
      (p.status === "pending" || p.status === "preparing") &&
      mediaFolderPathEqual(p.mediaFolderPath, mediaFolderPath),
  ) as T | undefined
}
