import type { CliProcessMonitor } from "./cliMonitor"
import { buildTimeoutFailure } from "./cliMonitor"
import {
  formatProbeResult,
  probeCliUiReady,
  type CliHttpProbeResult,
} from "./cliReadyProbe"
import { CliStartupError } from "./types"

/**
 * Permanent readiness wait for the Electron-spawned CLI UI port.
 *
 * Logs the first non-HTML response (e.g. intermittent 406 application/json on
 * Mac CI) so Startup Error / e2e artifacts retain Accept, status, content-type,
 * and a body snippet for the next reproduction.
 */
export async function waitForCliServerReady(
  port: number,
  monitor: CliProcessMonitor,
  options: {
    pollIntervalMs: number
    timeoutMs: number
    coreRoutesPort?: number
  },
): Promise<void> {
  const deadline = Date.now() + options.timeoutMs
  let loggedUnexpectedProbe = false
  let lastProbes: CliHttpProbeResult[] = []

  while (Date.now() < deadline) {
    const spawnError = monitor.getSpawnError()
    if (spawnError) {
      throw new CliStartupError(monitor.buildExitFailure())
    }

    if (monitor.hasExited()) {
      throw new CliStartupError(monitor.buildExitFailure())
    }

    const { ready, probes } = await probeCliUiReady(port, { timeoutMs: 1500 })
    lastProbes = probes
    if (ready) {
      return
    }

    if (!loggedUnexpectedProbe) {
      const connected = probes.some((p) => p.status !== null)
      if (connected) {
        loggedUnexpectedProbe = true
        console.error(
          "[SMM] CLI UI readiness probe got a non-HTML response while waiting:",
          probes.map(formatProbeResult).join(" | "),
        )
      }
    }

    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs))
  }

  if (monitor.hasExited()) {
    throw new CliStartupError(monitor.buildExitFailure())
  }

  throw new CliStartupError(
    await buildTimeoutFailure(port, monitor, {
      coreRoutesPort: options.coreRoutesPort,
      lastUiProbes: lastProbes,
    }),
  )
}
