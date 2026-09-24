import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from "./useStatusBar"
import type { WebSocketStatus } from "@/stores/webSocketStore"
import type { ConnectionStatus } from "./useStatusBar"

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(),
}))

vi.mock("@/stores/webSocketStore", () => ({
  useWebSocketStore: vi.fn(),
}))

import { useConfig } from "@/hooks/userConfig"
import { useWebSocketStore } from "@/stores/webSocketStore"

const mockUseConfig = useConfig as ReturnType<typeof vi.fn>
const mockUseWebSocketStore = useWebSocketStore as unknown as ReturnType<typeof vi.fn>

describe("mapWebSocketStatusToConnectionStatus", () => {
  it("maps connected to connected", () => {
    expect(mapWebSocketStatusToConnectionStatus("connected" as WebSocketStatus)).toBe("connected")
  })

  it("maps connecting to connecting", () => {
    expect(mapWebSocketStatusToConnectionStatus("connecting" as WebSocketStatus)).toBe("connecting")
  })

  it("maps disconnected to disconnected", () => {
    expect(mapWebSocketStatusToConnectionStatus("disconnected" as WebSocketStatus)).toBe("disconnected")
  })

  it("maps error to disconnected", () => {
    expect(mapWebSocketStatusToConnectionStatus("error" as WebSocketStatus)).toBe("disconnected")
  })

  it("maps unknown status to disconnected", () => {
    expect(mapWebSocketStatusToConnectionStatus("unknown" as WebSocketStatus)).toBe("disconnected")
  })
})

describe("useStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns connectionStatus from webSocketStore and version from config", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1.0.0" },
    } as never)
    mockUseWebSocketStore.mockImplementation((selector: (s: { status: WebSocketStatus }) => unknown) =>
      selector({ status: "connected" }),
    )

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe("connected")
    expect(result.current.version).toBe("1.0.0")
  })

  it("returns connectionStatus override when provided", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1.0.0" },
    } as never)
    mockUseWebSocketStore.mockImplementation((selector: (s: { status: WebSocketStatus }) => unknown) =>
      selector({ status: "connected" }),
    )

    const { result } = renderHook(() =>
      useStatusBar({
        connectionStatusOverride: "disconnected" as ConnectionStatus,
      }),
    )

    expect(result.current.connectionStatus).toBe("disconnected")
    expect(result.current.version).toBe("1.0.0")
  })

  it("returns version override when provided", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1.0.0" },
    } as never)
    mockUseWebSocketStore.mockImplementation((selector: (s: { status: WebSocketStatus }) => unknown) =>
      selector({ status: "connected" }),
    )

    const { result } = renderHook(() =>
      useStatusBar({
        versionOverride: "2.0.0",
      }),
    )

    expect(result.current.connectionStatus).toBe("connected")
    expect(result.current.version).toBe("2.0.0")
  })

  it("maps store error to disconnected", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1.0.0" },
    } as never)
    mockUseWebSocketStore.mockImplementation((selector: (s: { status: WebSocketStatus }) => unknown) =>
      selector({ status: "error" }),
    )

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe("disconnected")
  })

  it("handles missing appConfig version", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: undefined as unknown as string },
    } as never)
    mockUseWebSocketStore.mockImplementation((selector: (s: { status: WebSocketStatus }) => unknown) =>
      selector({ status: "connected" }),
    )

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.version).toBeUndefined()
  })
})
