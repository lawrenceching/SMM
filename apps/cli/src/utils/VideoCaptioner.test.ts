import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { getPythonScriptsCandidatePaths, transcribeWithVideoCaptioner, translateSubtitleWithVideoCaptioner, synthesizeWithVideoCaptioner, processWithVideoCaptioner, VIDEOCAPTIONER_CLI_DUMMY_API_KEY } from "./VideoCaptioner";

const h = vi.hoisted(() => ({
  spawn: vi.fn(),
  getUserConfig: vi.fn().mockResolvedValue({}),
  discoverFfmpeg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("child_process", () => ({
  spawn: h.spawn,
}));

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    getUserConfig: h.getUserConfig,
  };
});

vi.mock("./Ffmpeg", () => ({
  discoverFfmpeg: h.discoverFfmpeg,
}));

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  const platform = vi.fn().mockReturnValue("win32");
  return {
    ...actual,
    default: {
      ...actual,
      platform,
    },
    platform,
  };
});

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(
        (targetPath: string) =>
          !targetPath.includes("/missing/") &&
          (targetPath.endsWith(".mp3") ||
            targetPath.endsWith(".mp4") ||
            targetPath.endsWith(".srt") ||
            targetPath.includes("videocaptioner"))
      ),
    },
    existsSync: vi.fn(
      (targetPath: string) =>
        !targetPath.includes("/missing/") &&
        (targetPath.endsWith(".mp3") ||
          targetPath.endsWith(".mp4") ||
          targetPath.endsWith(".srt") ||
          targetPath.includes("videocaptioner"))
    ),
  };
});

type MockChild = EventEmitter & { once: EventEmitter["once"]; kill: ReturnType<typeof vi.fn> };

function createStreamStub() {
  let onData: ((chunk: string | Buffer) => void) | undefined;
  return {
    setEncoding: vi.fn(),
    on: vi.fn((ev: string, cb: (chunk: string | Buffer) => void) => {
      if (ev === "data") onData = cb;
    }),
    pushData: (chunk: string) => onData?.(chunk),
  };
}

function createMockChild(): MockChild {
  const emitter = new EventEmitter() as MockChild;
  emitter.kill = vi.fn();
  const stderrStub = createStreamStub();
  const stdoutStub = createStreamStub();
  (emitter as unknown as { stderr: typeof stderrStub; stdout: typeof stdoutStub }).stderr = stderrStub;
  (emitter as unknown as { stderr: typeof stderrStub; stdout: typeof stdoutStub }).stdout = stdoutStub;
  return emitter;
}

let logDirEnvPrev: string | undefined;
let logDirTmpRoot: string;

beforeEach(() => {
  logDirEnvPrev = process.env.LOG_DIR;
  logDirTmpRoot = mkdtempSync(path.join(tmpdir(), "smm-vc-test-"));
  process.env.LOG_DIR = logDirTmpRoot;
});

afterEach(async () => {
  if (logDirEnvPrev === undefined) {
    delete process.env.LOG_DIR;
  } else {
    process.env.LOG_DIR = logDirEnvPrev;
  }
  const fsActual = await vi.importActual<typeof import("fs")>("fs");
  if (fsActual.existsSync(logDirTmpRoot)) {
    fsActual.rmSync(logDirTmpRoot, { recursive: true, force: true });
  }
});

describe("getPythonScriptsCandidatePaths", () => {
  it("includes windows Python Scripts candidates for .exe", () => {
    const candidates = getPythonScriptsCandidatePaths("videocaptioner.exe");
    expect(candidates.some((p) => p.includes("Python310") && p.endsWith("videocaptioner.exe"))).toBe(true);
  });

  it("includes non-windows user-level candidates", () => {
    const candidates = getPythonScriptsCandidatePaths("videocaptioner");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((p) => p.endsWith("videocaptioner"))).toBe(true);
  });
});

describe("transcribeWithVideoCaptioner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns success when videocaptioner exits with code 0", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3");
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.logRelativePath).toContain("commands/");
    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      ["transcribe", "C:/media/a.mp3", "--asr", "bijian", "--format", "srt", "--api-key", VIDEOCAPTIONER_CLI_DUMMY_API_KEY],
      expect.any(Object)
    );
  });

  it("passes custom --asr when options.asr is set", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3", { asr: "jianying" });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      ["transcribe", "C:/media/a.mp3", "--asr", "jianying", "--format", "srt", "--api-key", VIDEOCAPTIONER_CLI_DUMMY_API_KEY],
      expect.any(Object)
    );
  });

  it("passes --language and --word-timestamps when set", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3", {
      asr: "bijian",
      language: "zh",
      wordTimestamps: true,
      format: "json",
    });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      ["transcribe", "C:/media/a.mp3", "--asr", "bijian", "--language", "zh", "--word-timestamps", "--format", "json", "--api-key", VIDEOCAPTIONER_CLI_DUMMY_API_KEY],
      expect.any(Object)
    );
  });

  it("returns error when videocaptioner exits with non-zero code", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3");
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 2);
    const result = await promise;

    expect(result.error).toContain("exited with code 2");
  });

  it("returns error when spawn emits runtime error", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3");
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("error", new Error("spawn failed"));
    const result = await promise;

    expect(result.error).toContain("spawn failed");
  });

  it("returns timeout error and kills child process", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3");
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    const result = await promise;

    expect(child.kill).toHaveBeenCalled();
    expect(result.error).toContain("timed out");
  });

  it("injects bundled ffmpeg dir into PATH when enabled in config", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);
    h.getUserConfig.mockResolvedValue({
      useBundledFfmpegForVideoCaptioner: true,
    });
    h.discoverFfmpeg.mockResolvedValueOnce("C:/SMM/bin/ffmpeg/ffmpeg.exe");

    const promise = transcribeWithVideoCaptioner("C:/media/a.mp3");
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    const spawnCall = h.spawn.mock.calls[0]!;
    const options = spawnCall[2] as { env?: NodeJS.ProcessEnv };
    expect(options.env).toBeDefined();
    const envPath = options.env!.PATH || options.env!.Path || "";
    expect(envPath.toLowerCase().startsWith("c:/smm/bin/ffmpeg".toLowerCase())).toBe(true);
  });
});

describe("translateSubtitleWithVideoCaptioner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes subtitle with translator, target language, and skip optimize/split", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = translateSubtitleWithVideoCaptioner("C:/media/a.srt", {
      translator: "bing",
      targetLanguage: "zh-Hans",
    });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      [
        "subtitle",
        "C:/media/a.srt",
        "--translator",
        "bing",
        "--target-language",
        "zh-Hans",
        "--no-optimize",
        "--no-split",
        "--api-key",
        VIDEOCAPTIONER_CLI_DUMMY_API_KEY,
      ],
      expect.any(Object)
    );
  });

  it("passes --reflect and --layout when set", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = translateSubtitleWithVideoCaptioner("C:/media/a.srt", {
      translator: "llm",
      targetLanguage: "en",
      reflect: true,
      layout: "target-only",
      llm: { apiKey: "sk-test", apiBase: "https://api.example/v1", model: "gpt-4o-mini" },
    });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      [
        "subtitle",
        "C:/media/a.srt",
        "--translator",
        "llm",
        "--target-language",
        "en",
        "--no-optimize",
        "--no-split",
        "--reflect",
        "--layout",
        "target-only",
        "--api-key",
        "sk-test",
        "--api-base",
        "https://api.example/v1",
        "--model",
        "gpt-4o-mini",
      ],
      expect.any(Object)
    );
  });

  it("returns error when subtitle file is missing", async () => {
    const result = await translateSubtitleWithVideoCaptioner("C:/missing/foo.vtt", {
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.error).toContain("file not found");
  });

  it("returns timeout error and kills child process", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = translateSubtitleWithVideoCaptioner("C:/media/a.srt", {
      translator: "google",
      targetLanguage: "ja",
    });
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    const result = await promise;

    expect(child.kill).toHaveBeenCalled();
    expect(result.error).toContain("timed out");
  });
});

describe("synthesizeWithVideoCaptioner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes synthesize with video, -s subtitle, and optional flags", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = synthesizeWithVideoCaptioner("C:/media/a.mp4", "C:/media/a.srt", {
      subtitleMode: "hard",
      quality: "medium",
      style: "anime",
      renderMode: "ass",
      layout: "source-only",
    });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      [
        "synthesize",
        "C:/media/a.mp4",
        "-s",
        "C:/media/a.srt",
        "--subtitle-mode",
        "hard",
        "--quality",
        "medium",
        "--style",
        "anime",
        "--render-mode",
        "ass",
        "--layout",
        "source-only",
        "--api-key",
        VIDEOCAPTIONER_CLI_DUMMY_API_KEY,
      ],
      expect.any(Object)
    );
  });

  it("returns error when video file is missing", async () => {
    const result = await synthesizeWithVideoCaptioner("C:/missing/foo.mp4", "C:/media/a.srt");
    expect(result.error).toContain("file not found");
  });

  it("returns timeout error and kills child process", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = synthesizeWithVideoCaptioner("C:/media/a.mp4", "C:/media/a.srt");
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    const result = await promise;

    expect(child.kill).toHaveBeenCalled();
    expect(result.error).toContain("timed out");
  });
});

describe("processWithVideoCaptioner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes process with media path and pipeline flags", async () => {
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = processWithVideoCaptioner("C:/media/a.mp4", {
      transcribe: { asr: "bijian", format: "srt" },
      translator: "bing",
      targetLanguage: "en",
      noSynthesize: true,
    });
    await vi.waitFor(() => expect(h.spawn).toHaveBeenCalled());
    child.emit("close", 0);
    await promise;

    expect(h.spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "process",
        "C:/media/a.mp4",
        "--asr",
        "bijian",
        "--format",
        "srt",
        "--translator",
        "bing",
        "--target-language",
        "en",
        "--no-synthesize",
        "--api-key",
        VIDEOCAPTIONER_CLI_DUMMY_API_KEY,
      ]),
      expect.any(Object),
    );
  });

  it("returns error when media file is missing", async () => {
    const result = await processWithVideoCaptioner("C:/missing/foo.mp4", {
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.error).toContain("file not found");
  });

  it("returns timeout error and kills child process", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    h.spawn.mockReturnValue(child);

    const promise = processWithVideoCaptioner("C:/media/a.mp4", {
      translator: "bing",
      targetLanguage: "en",
    });
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    const result = await promise;

    expect(child.kill).toHaveBeenCalled();
    expect(result.error).toContain("timed out");
  });
});
