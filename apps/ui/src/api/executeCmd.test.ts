import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { executeCmdStream } from "./executeCmd";

function mockNdjsonResponse(ndjson: string) {
  return {
    ok: true,
    headers: { get: () => null },
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new TextEncoder().encode(ndjson) };
          },
          cancel: async () => {},
        };
      },
    },
  };
}

describe("executeCmdStream", () => {
  beforeEach(() => {
    // If a future change routes through withDevApiUrl again, this makes the
    // absolute CLI origin visible so the assertion below fails.
    vi.stubEnv("VITE_DEV_CLI_URL", "http://localhost:8082");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs via relative /api path so Vite proxy can attach auth", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const ndjson = `${JSON.stringify({ type: "system", data: { event: "exit", code: 0 } })}\n`;
    fetchMock.mockResolvedValueOnce(mockNdjsonResponse(ndjson));

    await new Promise<void>((resolve, reject) => {
      executeCmdStream(
        { command: "ffmpeg", args: ["-version"] },
        {
          onMessage: () => {},
          onComplete: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/executeCmd",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
