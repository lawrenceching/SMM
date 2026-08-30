/**
 * Shared Plan primitives for {@link RecognizeMediaFilePlan} and
 * {@link RenameFilesPlan}.
 */

/**
 * Plan lifecycle status.
 * - `preparing`: plan created, content not computed yet (shows loading prompt)
 * - `pending`: ready for user review
 * - `completed`: user confirmed / applied (plan file is deleted)
 * - `rejected`: user cancelled; the plan file is kept so any in-flight
 *   `add-*-file` / `end-*-task` calls from the AI can detect the
 *   cancellation and return a clear stop message.
 */
export type PlanStatus = "preparing" | "pending" | "completed" | "rejected";

/**
 * Who created the plan.
 * - `app`: rule-based recognize / rename triggered from the UI
 * - `ai`: AI Assistant or MCP tool
 */
export type PlanCreator = "app" | "ai";

/**
 * Statuses for which a plan is still "active" (visible to the UI).
 * `completed` plans have their file deleted; `rejected` plans are kept
 * (with `status: "rejected"`) so a still-in-flight AI workflow can
 * detect the cancellation — see `updatePlanContent` in core-routes.
 */
export const ACTIVE_PLAN_STATUSES: readonly PlanStatus[] = ["preparing", "pending"];

export function isActivePlanStatus(status: PlanStatus): boolean {
  return status === "preparing" || status === "pending";
}

export function isTerminalPlanStatus(status: PlanStatus): boolean {
  return status === "completed" || status === "rejected";
}
