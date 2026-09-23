import i18n from "@/lib/i18n"

/**
 * Best-effort system notification when a pending AI/MCP plan is ready for approval.
 * Only fires when the document is hidden, Notification API is available, and
 * permission is already "granted". Never prompts for permission.
 */
export function showPlanReadyNotification(taskId: string): void {
  try {
    if (typeof document === "undefined" || !document.hidden) {
      return
    }

    if (typeof window === "undefined" || typeof window.Notification !== "function") {
      return
    }

    if (window.Notification.permission !== "granted") {
      return
    }

    const title = i18n.t("planReady.notification.title")
    const body = i18n.t("planReady.notification.body")
    const notification = new window.Notification(title, {
      body,
      tag: `smm-plan-ready-${taskId}`,
    })
    notification.onclick = () => {
      window.focus()
    }
  } catch {
    // Best-effort: never affect plan processing
  }
}
