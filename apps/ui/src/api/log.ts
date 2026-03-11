export type FrontendLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

export interface FrontendLogPayload {
  level?: FrontendLogLevel
  message: string
  context?: Record<string, unknown>
}

/**
 * Send log to backend logging API.
 * Errors are swallowed to avoid affecting user flows.
 */
export async function writeFrontendLog(payload: FrontendLogPayload): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Silent failure by design.
  }
}

