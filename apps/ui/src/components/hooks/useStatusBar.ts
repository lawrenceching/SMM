import { useConfig } from "@/hooks/userConfig"
import { useWebSocketStore, type WebSocketStatus } from "@/stores/webSocketStore"

export type ConnectionStatus = "connected" | "disconnected" | "connecting"

export function mapWebSocketStatusToConnectionStatus(status: WebSocketStatus): ConnectionStatus {
  switch (status) {
    case "connected":
      return "connected"
    case "connecting":
      return "connecting"
    case "disconnected":
    case "error":
    default:
      return "disconnected"
  }
}

interface UseStatusBarOptions {
  connectionStatusOverride?: ConnectionStatus
  versionOverride?: string
}

interface UseStatusBarResult {
  connectionStatus: ConnectionStatus
  version: string
}

/**
 * StatusBar data. Connection status is read from the shared webSocketStore
 * (written by SocketBridge). This hook must never call useWebSocket()/io().
 */
export function useStatusBar(options?: UseStatusBarOptions): UseStatusBarResult {
  const { appConfig } = useConfig()
  const status = useWebSocketStore((s) => s.status)

  return {
    connectionStatus:
      options?.connectionStatusOverride ?? mapWebSocketStatusToConnectionStatus(status),
    version: options?.versionOverride ?? appConfig.version,
  }
}
