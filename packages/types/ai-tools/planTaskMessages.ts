/**
 * Shown when an end-*-task tool finalizes a plan and waits for user approval.
 */
export const END_PLAN_TASK_SUCCESS_MESSAGE =
  "Task is created successfuly. User need to go to SMM, review and approve the task.";

/**
 * Returned to the AI when `add-*-file` or `end-*-task` is called for a
 * plan that the user has already cancelled (status === "rejected").
 * Tells the AI to stop the in-flight workflow instead of queueing
 * more file entries or finalising the plan.
 */
export const PLAN_CANCELLED_BY_USER_MESSAGE =
  "该任务已被用户取消, 请停止后续操作";

/**
 * Returned to the AI when the rename plan was applied automatically
 * because the user granted the `metadata.write` permission.
 */
export const RENAME_PLAN_AUTO_APPLIED_MESSAGE =
  "Rename plan applied automatically (metadata.write permission granted). No user approval needed.";

/**
 * Returned to the AI when the recognize plan was applied automatically
 * because the user granted the `metadata.write` permission.
 */
export const RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE =
  "Recognize plan applied automatically (metadata.write permission granted). No user approval needed.";
