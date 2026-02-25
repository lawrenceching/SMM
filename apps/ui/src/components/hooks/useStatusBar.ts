import { useConfig } from "@/providers/config-provider"
import { useWebSocket, type WebSocketStatus } from "@/hooks/useWebSocket"
import { type ConnectionStatus } from "../ConnectionStatusIndicator"

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

export function useStatusBar(options?: UseStatusBarOptions): UseStatusBarResult {
    const { appConfig } = useConfig()
    const { status } = useWebSocket()

    return {
        connectionStatus: options?.connectionStatusOverride 
            ?? mapWebSocketStatusToConnectionStatus(status),
        version: options?.versionOverride ?? appConfig.version,
    }
}
