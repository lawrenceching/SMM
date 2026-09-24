import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const { ioMock, socketFactory } = vi.hoisted(() => {
  const sockets: Array<{
    connected: boolean
    on: ReturnType<typeof vi.fn>
    onAny: ReturnType<typeof vi.fn>
    emit: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    removeAllListeners: ReturnType<typeof vi.fn>
  }> = []

  const socketFactory = () => {
    const socket = {
      connected: false,
      on: vi.fn(),
      onAny: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
    }
    sockets.push(socket)
    return socket
  }

  return {
    ioMock: vi.fn(() => socketFactory()),
    socketFactory,
    sockets,
  }
})

vi.mock("socket.io-client", () => ({
  io: ioMock,
}))

import { useWebSocket, __resetSharedSocketForTests } from "./useWebSocket"
import { useWebSocketStore } from "@/stores/webSocketStore"

describe("useWebSocket singleton", () => {
  beforeEach(() => {
    __resetSharedSocketForTests()
    ioMock.mockClear()
    ioMock.mockImplementation(() => socketFactory())
    useWebSocketStore.setState({ status: "disconnected" })
  })

  afterEach(() => {
    __resetSharedSocketForTests()
  })

  it("calls io() only once when two hooks mount", () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())

    expect(ioMock).toHaveBeenCalledTimes(1)

    first.unmount()
    second.unmount()
  })

  it("keeps the connection until the last hook unmounts", () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())

    const socket = ioMock.mock.results[0]?.value as { disconnect: ReturnType<typeof vi.fn> }
    first.unmount()
    expect(socket.disconnect).not.toHaveBeenCalled()

    second.unmount()
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })
})
