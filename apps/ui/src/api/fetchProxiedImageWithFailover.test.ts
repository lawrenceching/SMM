/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest"
import type { DiscoverConfig } from "./discover"

const config: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
}

describe("fetchProxiedImageWithFailover", () => {
  it("tries mirror after official /api/image fails", async () => {
    const fetchImpl = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "err" } as Response)
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["img"], { type: "image/jpeg" }),
      } as Response)

    const { fetchProxiedImageWithFailover } = await import("./fetchProxiedImageWithFailover")
    const blob = await fetchProxiedImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      {
        fetchDiscoverConfig: async () => config,
        fetchImpl,
      },
    )

    expect(await blob.text()).toBe("img")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      encodeURIComponent("https://image.tmdb.org/t/p/original/a.jpg"),
    )
    expect(String(fetchImpl.mock.calls[1]![0])).toContain(
      encodeURIComponent("https://tmdb-mirror.example/t/p/original/a.jpg"),
    )
  })

  it("rethrows AbortError without trying further candidates", async () => {
    const abortError = new DOMException("Aborted", "AbortError")
    const fetchImpl = vi.fn().mockRejectedValue(abortError)

    const { fetchProxiedImageWithFailover } = await import("./fetchProxiedImageWithFailover")
    await expect(
      fetchProxiedImageWithFailover("https://image.tmdb.org/t/p/original/a.jpg", {
        fetchDiscoverConfig: async () => config,
        fetchImpl,
        signal: AbortSignal.abort(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
