import { describe, it, expect, vi } from "vitest";
import { processVideoCaptionerTranscribe } from "./Transcribe";

const h = vi.hoisted(() => ({
  transcribeWithVideoCaptioner: vi.fn(),
}));

vi.mock("../../utils/VideoCaptioner", () => ({
  transcribeWithVideoCaptioner: h.transcribeWithVideoCaptioner,
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("processVideoCaptionerTranscribe", () => {
  it("returns success when command completes", async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ success: true });
    const result = await processVideoCaptionerTranscribe({ mediaPath: "C:/a.mp4" });
    expect(result.success).toBe(true);
    expect(h.transcribeWithVideoCaptioner).toHaveBeenCalledWith("C:/a.mp4");
  });

  it("returns normalized error when command fails", async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ error: "boom" });
    const result = await processVideoCaptionerTranscribe({ mediaPath: "C:/a.mp4" });
    expect(result.error).toBe("boom");
  });
});
