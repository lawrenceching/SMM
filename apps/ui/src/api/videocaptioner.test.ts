/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverVideoCaptioner, transcribeWithVideoCaptioner } from "./videocaptioner";

describe("videocaptioner api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls discover endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ path: "C:/bin/videocaptioner.exe" }),
    } as Response);
    const result = await discoverVideoCaptioner();
    expect(result.path).toBe("C:/bin/videocaptioner.exe");
    expect(fetch).toHaveBeenCalledWith("/api/videocaptioner/discover", { method: "GET" });
  });

  it("calls transcribe endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);
    const result = await transcribeWithVideoCaptioner({ mediaPath: "C:/a.mp4" });
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/videocaptioner/transcribe",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
