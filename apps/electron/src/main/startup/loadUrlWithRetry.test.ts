import { describe, expect, it } from "vitest"
import { loadUrlWithRetry } from "./loadUrlWithRetry"

describe("loadUrlWithRetry", () => {
  it("retries a refused load and then succeeds", async () => {
    const sleeps: number[] = []
    let calls = 0
    await loadUrlWithRetry(
      async () => {
        calls += 1
        if (calls < 3) {
          throw new Error("ERR_CONNECTION_REFUSED")
        }
      },
      "http://127.0.0.1:30000",
      {
        attempts: 5,
        delayMs: 500,
        sleep: async (ms) => {
          sleeps.push(ms)
        },
      },
    )
    expect(calls).toBe(3)
    expect(sleeps).toEqual([500, 500])
  })

  it("throws the last error when every attempt fails", async () => {
    let calls = 0
    await expect(
      loadUrlWithRetry(
        async () => {
          calls += 1
          throw new Error("ERR_CONNECTION_REFUSED")
        },
        "http://127.0.0.1:30000",
        { attempts: 2, sleep: async () => {} },
      ),
    ).rejects.toThrow("ERR_CONNECTION_REFUSED")
    expect(calls).toBe(2)
  })
})
