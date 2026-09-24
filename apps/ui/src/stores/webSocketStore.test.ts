import { describe, it, expect, beforeEach } from "vitest"
import { useWebSocketStore } from "./webSocketStore"

describe("webSocketStore", () => {
  beforeEach(() => {
    useWebSocketStore.setState({ status: "disconnected" })
  })

  it("defaults to disconnected", () => {
    expect(useWebSocketStore.getState().status).toBe("disconnected")
  })

  it("setStatus updates connection status", () => {
    useWebSocketStore.getState().setStatus("connecting")
    expect(useWebSocketStore.getState().status).toBe("connecting")

    useWebSocketStore.getState().setStatus("connected")
    expect(useWebSocketStore.getState().status).toBe("connected")

    useWebSocketStore.getState().setStatus("error")
    expect(useWebSocketStore.getState().status).toBe("error")
  })
})
