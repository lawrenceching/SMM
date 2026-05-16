/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverVideoCaptioner, transcribeWithVideoCaptioner } from "./videocaptioner";

vi.mock("@/lib/whitelistedCmd/probeWhitelistedCommand", () => ({
  probeWhitelistedCommand: vi.fn(),
}));

vi.mock("@/lib/whitelistedCmd/executeCmdToCompletion", () => ({
  executeCmdToCompletionWithHeaders: vi.fn(),
}));

import { probeWhitelistedCommand } from "@/lib/whitelistedCmd/probeWhitelistedCommand";
import { executeCmdToCompletionWithHeaders } from "@/lib/whitelistedCmd/executeCmdToCompletion";

describe("videocaptioner api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("probes videocaptioner availability", async () => {
    vi.mocked(probeWhitelistedCommand).mockResolvedValue({ available: true });
    const result = await discoverVideoCaptioner();
    expect(result.path).toBe("videocaptioner");
    expect(probeWhitelistedCommand).toHaveBeenCalledWith("videocaptioner");
  });

  it("runs transcribe via executeCmd", async () => {
    vi.mocked(executeCmdToCompletionWithHeaders).mockResolvedValue({
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    const result = await transcribeWithVideoCaptioner({ mediaPath: "C:/a.mp4" });
    expect(result.success).toBe(true);
    expect(executeCmdToCompletionWithHeaders).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "videocaptioner",
        args: expect.arrayContaining(["transcribe", "C:/a.mp4"]),
      }),
      expect.any(Object)
    );
  });

  it("includes asr in args when provided", async () => {
    vi.mocked(executeCmdToCompletionWithHeaders).mockResolvedValue({
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    await transcribeWithVideoCaptioner({ mediaPath: "C:/a.mp4", asr: "jianying" });
    expect(executeCmdToCompletionWithHeaders).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--asr", "jianying"]),
      }),
      expect.any(Object)
    );
  });
});
