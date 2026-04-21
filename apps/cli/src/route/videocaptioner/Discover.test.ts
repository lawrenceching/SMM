import { describe, it, expect, vi } from "vitest";
import { processVideoCaptionerDiscover } from "./Discover";

const h = vi.hoisted(() => ({
  discoverVideoCaptioner: vi.fn(),
}));

vi.mock("../../utils/VideoCaptioner", () => ({
  discoverVideoCaptioner: h.discoverVideoCaptioner,
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("processVideoCaptionerDiscover", () => {
  it("returns discovered path", async () => {
    h.discoverVideoCaptioner.mockResolvedValue("C:/bin/videocaptioner.exe");
    const result = await processVideoCaptionerDiscover();
    expect(result.path).toBe("C:/bin/videocaptioner.exe");
    expect(result.error).toBeUndefined();
  });

  it("returns not found error when missing", async () => {
    h.discoverVideoCaptioner.mockResolvedValue(undefined);
    const result = await processVideoCaptionerDiscover();
    expect(result.error).toBe("videocaptioner not found");
  });
});
