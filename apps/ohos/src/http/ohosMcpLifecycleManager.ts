import type { McpLifecycleManager, McpServerState } from "@smm/core-routes"

export interface OhosMcpLifecycleManagerOptions {
  /** e.g. http://127.0.0.1:18081 */
  mainOrigin: string
  /** Called when MCP is stopped (clears cached protocol handler). */
  onStop?: () => void
}

export type OhosMcpLifecycleManager = McpLifecycleManager & {
  isEnabled(): boolean
}

let instance: OhosMcpLifecycleManager | null = null

export function createOhosMcpLifecycleManager(
  options: OhosMcpLifecycleManagerOptions,
): OhosMcpLifecycleManager {
  let enabled = false
  const mcpUrl = `${options.mainOrigin.replace(/\/$/, "")}/mcp`

  const manager: OhosMcpLifecycleManager = {
    async start() {
      enabled = true
    },
    async stop() {
      enabled = false
      options.onStop?.()
    },
    getState(): McpServerState {
      if (enabled) {
        const url = new URL(mcpUrl)
        return {
          status: "running",
          host: url.hostname,
          port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
          url: mcpUrl,
        }
      }
      return { status: "stopped", url: mcpUrl }
    },
    isEnabled() {
      return enabled
    },
  }

  instance = manager
  return manager
}

/** Returns whether the OHOS MCP endpoint accepts protocol requests. */
export function isOhosMcpEnabled(): boolean {
  return instance?.isEnabled() ?? false
}

export function getOhosMcpLifecycleManager(): OhosMcpLifecycleManager | null {
  return instance
}
