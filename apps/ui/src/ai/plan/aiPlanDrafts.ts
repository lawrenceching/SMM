import type { Plan } from "@/api/getPlans"

/**
 * In-memory drafts for the *frontend* AI tool path
 * (`ReverseProxyChatTransport`). The unified `/api/updatePlan` endpoint
 * replaces a plan's `files` wholesale, so the browser-side `add-*`
 * tools accumulate entries here between `begin` and `end` instead of
 * round-tripping the full plan each call.
 *
 * The backend (cli/MCP) path does NOT use this — it appends directly to
 * the plan file via `@smm/core-routes`.
 */
const drafts = new Map<string, Plan>()

export function setPlanDraft(plan: Plan): void {
  drafts.set(plan.id, plan)
}

export function getPlanDraft(id: string): Plan | null {
  return drafts.get(id) ?? null
}

export function deletePlanDraft(id: string): void {
  drafts.delete(id)
}
