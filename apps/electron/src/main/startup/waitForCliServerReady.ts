import type { CliProcessMonitor } from "./cliMonitor"
import { buildTimeoutFailure } from "./cliMonitor"
import { CliStartupError } from "./types"

export async function isServerServingHtml(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, { method: "GET" })
    const contentType = res.headers.get("content-type") ?? ""
    return res.ok && contentType.includes("text/html")
  } catch {
    return false
  }
}

export async function waitForCliServerReady(
  port: number,
  monitor: CliProcessMonitor,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<void> {
  const deadline = Date.now() + options.timeoutMs

  while (Date.now() < deadline) {
    const spawnError = monitor.getSpawnError()
    if (spawnError) {
      throw new CliStartupError(monitor.buildExitFailure())
    }

    if (monitor.hasExited()) {
      throw new CliStartupError(monitor.buildExitFailure())
    }

    if (await isServerServingHtml(port)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs))
  }

  if (monitor.hasExited()) {
    throw new CliStartupError(monitor.buildExitFailure())
  }

  throw new CliStartupError(buildTimeoutFailure(port, monitor))
}
