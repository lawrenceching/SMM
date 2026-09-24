import { create } from "zustand"

/** Shared Socket.IO connection status — written only by the SocketBridge / useWebSocket owner. */
export type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error"

interface WebSocketState {
  status: WebSocketStatus
  setStatus: (status: WebSocketStatus) => void
}

export const useWebSocketStore = create<WebSocketState>()((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
}))
