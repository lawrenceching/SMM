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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);
    const result = await transcribeWithVideoCaptioner({ mediaPath: "C:/a.mp4" });
    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/videocaptioner/transcribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mediaPath: "C:/a.mp4" }),
      }),
    );
  });

  it("includes asr in body when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);
    await transcribeWithVideoCaptioner({ mediaPath: "C:/a.mp4", asr: "jianying" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/videocaptioner/transcribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mediaPath: "C:/a.mp4", asr: "jianying" }),
      }),
    );
  });
});
