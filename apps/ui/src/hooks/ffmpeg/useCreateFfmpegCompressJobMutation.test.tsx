import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Path } from "@smm/utils/path";
import { useCreateFfmpegCompressJobMutation } from "./useCreateFfmpegCompressJobMutation";
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore";

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  ffmpegCompressViaCore: vi.fn().mockResolvedValue({ id: "core-compress-1" }),
  pollFfmpegJob: vi.fn().mockResolvedValue({
    kind: "ffmpeg-compress",
    id: "core-compress-1",
    status: "succeeded",
    progress: 100,
  }),
}));

vi.mock("@/api/ffmpegCompress", () => ({
  ffmpegCompressViaCore: h.ffmpegCompressViaCore,
}));

vi.mock("@/lib/pollFfmpegJob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pollFfmpegJob")>();
  return {
    ...actual,
    pollFfmpegJob: h.pollFfmpegJob,
  };
});

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({ createJob: h.createJob }),
}));

const compressOptions = {
  presetKey: "balanced" as const,
  container: "mp4" as const,
  videoEncoder: "libx264",
  qualityMode: "crf" as const,
  crf: 23,
  encoderPreset: "medium" as const,
  resolutionMode: "original" as const,
  frameRateMode: "original" as const,
  audioMode: "keep" as const,
  twoPass: false,
  hdr: "preserve" as const,
  filters: { denoise: "none" as const, sharpen: false },
  metadata: "preserve" as const,
};

describe("useCreateFfmpegCompressJobMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.createJob.mockResolvedValue("orch-id");
    h.ffmpegCompressViaCore.mockResolvedValue({ id: "core-compress-1" });
    useBackgroundJobsStore.setState({ jobs: [] });
  });

  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it("enqueues via Core without createJob and starts poll", async () => {
    const { result } = renderHook(() => useCreateFfmpegCompressJobMutation(), {
      wrapper,
    });

    await result.current.mutateAsync({
      inputPath: "/media/clip.mp4",
      outputPath: "/media/clip (1).mp4",
      compressOptions,
      title: "clip.mp4",
    });

    await waitFor(() => expect(h.ffmpegCompressViaCore).toHaveBeenCalledTimes(1));
    expect(h.createJob).not.toHaveBeenCalled();

    const arg = h.ffmpegCompressViaCore.mock.calls[0]![0];
    expect(arg.inputPath).toBe(Path.toPlatformPath(Path.posix("/media/clip.mp4")));
    expect(arg.outputPath).toBe(Path.toPlatformPath(Path.posix("/media/clip (1).mp4")));
    expect(arg.folder).toBe(Path.toPlatformPath(Path.posix("/media")));
    expect(arg.compressOptions).toEqual(compressOptions);
    expect(arg.compressOptions.container).toBe("mp4");
    expect(arg.title).toBe("clip.mp4");
    // Core path must not send opaque compress-* format tokens
    expect(arg).not.toHaveProperty("outputFormat");

    const jobs = useBackgroundJobsStore.getState().jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.type).toBe("ffmpeg-compress");
    expect(jobs[0]!.status).toBe("pending");
    expect(h.pollFfmpegJob).toHaveBeenCalledWith(
      "core-compress-1",
      "ffmpeg-compress",
      expect.any(Function),
    );
  });
});
