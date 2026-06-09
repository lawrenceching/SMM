import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCreateFfmpegCompressJobMutation } from "./useCreateFfmpegCompressJobMutation";

const createJobMock = vi.fn().mockResolvedValue("job-1");

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({ createJob: createJobMock }),
}));

describe("useCreateFfmpegCompressJobMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createJobMock.mockResolvedValue("job-1");
  });

  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it("builds a compress job and calls createJob", async () => {
    const { result } = renderHook(() => useCreateFfmpegCompressJobMutation(), {
      wrapper,
    });

    await result.current.mutateAsync({
      inputPath: "/media/clip.mp4",
      outputPath: "/media/clip (1).mp4",
      outputContainer: "mp4",
      compressOptions: {
        presetKey: "balanced",
        container: "mp4",
        videoEncoder: "libx264",
        qualityMode: "crf",
        crf: 23,
        encoderPreset: "medium",
        resolutionMode: "original",
        frameRateMode: "original",
        audioMode: "keep",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "none", sharpen: false },
        metadata: "preserve",
      },
      title: "clip.mp4",
    });

    await waitFor(() => expect(createJobMock).toHaveBeenCalledTimes(1));
    const job = createJobMock.mock.calls[0][0];
    expect(job.type).toBe("ffmpeg-convert");
    expect(job.data.outputFormat).toBe("compress-mp4");
    expect(job.data.compressOptions.container).toBe("mp4");
  });
});
