import { describe, it, expect } from "vitest"
import {
  createOhosMcpLifecycleManager,
  isOhosMcpEnabled,
} from "./ohosMcpLifecycleManager"

describe("createOhosMcpLifecycleManager", () => {
  it("starts disabled and gates protocol access", async () => {
    const manager = createOhosMcpLifecycleManager({
      mainOrigin: "http://127.0.0.1:18081",
    })
    expect(isOhosMcpEnabled()).toBe(false)
    expect(manager.getState().status).toBe("stopped")

    await manager.start()
    expect(isOhosMcpEnabled()).toBe(true)
    expect(manager.getState()).toMatchObject({
      status: "running",
      url: "http://127.0.0.1:18081/mcp",
      host: "127.0.0.1",
      port: 18081,
    })

    await manager.stop()
    expect(isOhosMcpEnabled()).toBe(false)
    expect(manager.getState().status).toBe("stopped")
  })

  it("calls onStop when stopped", async () => {
    let stopped = false
    const manager = createOhosMcpLifecycleManager({
      mainOrigin: "http://127.0.0.1:18081",
      onStop: () => {
        stopped = true
      },
    })
    await manager.start()
    await manager.stop()
    expect(stopped).toBe(true)
  })
})
