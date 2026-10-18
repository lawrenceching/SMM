import type { AppContext, PlatformPorts } from "../types";
import type { FfmpegPort } from "../ports/FfmpegPort";
import {
  computeFfmpegProgress,
  parseDurationSeconds,
  parseFfmpegProgressLine,
} from "../pipeline/ffmpeg/progress";
import { parseFfprobeJson } from "../pipeline/ffmpeg/probe";
import { buildFfmpegCompressArgs } from "../whitelistedCmd/ffmpeg";
import type { FfmpegCompressOptions } from "../whitelistedCmd/constants";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { FfmpegCompressJobSnapshot } from "./types";

export interface FfmpegCompressJobOptions {
  folder: string;
  inputPath: string;
  outputPath: string;
  compressOptions: FfmpegCompressOptions;
  title?: string;
}

/**
 * Single-file ffmpeg compression (probe → single or two-pass).
 * Log lines go to `${logDir}/${id}.log`.
 */
export class FfmpegCompressJob extends AbstractJob {
  private readonly folder: string;
  private readonly inputPath: string;
  private readonly outputPath: string;
  private readonly compressOptions: FfmpegCompressOptions;
  private readonly title: string | undefined;

  private etaSeconds: number | undefined;
  private totalSeconds: number | undefined;
  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;
  private progressMapStart = 0;
  private progressMapEnd = 100;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: FfmpegCompressJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "ffmpeg-compress",
    });
    this.folder = options.folder.trim();
    this.inputPath = options.inputPath.trim();
    this.outputPath = options.outputPath.trim();
    this.compressOptions = options.compressOptions;
    this.title = options.title?.trim() || undefined;
  }

  toJSON(): FfmpegCompressJobSnapshot {
    return {
      kind: "ffmpeg-compress",
      id: this.id,
      type: "ffmpeg-compress",
      folder: this.folder,
      inputPath: this.inputPath,
      outputPath: this.outputPath,
      ...(this.title !== undefined ? { title: this.title } : {}),
      compressOptions: this.compressOptions,
      status: this.status,
      progress: this.progress(),
      ...(this.etaSeconds !== undefined ? { etaSeconds: this.etaSeconds } : {}),
      ...(this.errorMessage !== undefined ? { error: this.errorMessage } : {}),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  override async run(): Promise<void> {
    this.setStatus("running");
    this.touch();
    try {
      if (this.requestToAbort) {
        this.setStatus("aborted");
        this.touch();
        return;
      }

      let ffmpeg: FfmpegPort;
      try {
        ffmpeg = this.requireFfmpeg();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.errorMessage = message;
        await this.log(message);
        this.setStatus("failed");
        this.touch();
        return;
      }

      this.abortController = new AbortController();
      if (this.requestToAbort) {
        this.abortController.abort();
      }

      const probeResult = await this.runFfmpeg(
        ffmpeg,
        {
          command: "ffprobe",
          args: [
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            this.inputPath,
          ],
        },
      );
      if (probeResult === "aborted" || probeResult === "failed") {
        return;
      }

      const probe = parseFfprobeJson(probeResult.stdout);
      const compressRun = buildFfmpegCompressArgs(
        this.inputPath,
        this.outputPath,
        this.compressOptions,
        probe,
      );

      await this.log(`Started ffmpeg compress: ${this.inputPath}`);

      if (compressRun.kind === "single") {
        this.progressMapStart = 0;
        this.progressMapEnd = 100;
        this.totalSeconds = undefined;
        const result = await this.runFfmpeg(ffmpeg, {
          command: "ffmpeg",
          args: compressRun.args,
          onStderrLine: (line) => {
            this.applyStderrLine(line);
          },
        });
        if (result === "aborted" || result === "failed") {
          return;
        }
        this.setProgress(100);
        this.touch();
        return;
      }

      // Two-pass
      try {
        this.progressMapStart = 0;
        this.progressMapEnd = 50;
        this.totalSeconds = undefined;
        const pass1 = await this.runFfmpeg(ffmpeg, {
          command: "ffmpeg",
          args: compressRun.pass1Args,
          onStderrLine: (line) => {
            this.applyStderrLine(line);
          },
        });
        if (pass1 === "aborted" || pass1 === "failed") {
          return;
        }

        this.setProgress(50);
        this.touch();

        this.progressMapStart = 50;
        this.progressMapEnd = 100;
        this.totalSeconds = undefined;
        const pass2 = await this.runFfmpeg(ffmpeg, {
          command: "ffmpeg",
          args: compressRun.pass2Args,
          onStderrLine: (line) => {
            this.applyStderrLine(line);
          },
        });
        if (pass2 === "aborted" || pass2 === "failed") {
          return;
        }

        this.setProgress(100);
        this.touch();
      } finally {
        await this.cleanupPassLog(compressRun.passLogPath);
      }
    } finally {
      this.abortController = undefined;
    }
  }

  override async abort(): Promise<void> {
    this.tryAbort();
    this.abortController?.abort();
  }

  private requireFfmpeg(): FfmpegPort {
    const ffmpeg = this.ports.ffmpeg;
    if (ffmpeg === undefined) {
      throw new Error("FfmpegPort is required for FfmpegCompressJob");
    }
    return ffmpeg;
  }

  /**
   * Run one ffmpeg/ffprobe invocation. Returns the result on success,
   * or `"aborted"` / `"failed"` after updating job status.
   */
  private async runFfmpeg(
    ffmpeg: FfmpegPort,
    request: {
      command: "ffmpeg" | "ffprobe";
      args: string[];
      onStderrLine?: (line: string) => void;
    },
  ): Promise<{ exitCode: number; stdout: string; stderr: string } | "aborted" | "failed"> {
    const signal = this.abortController!.signal;

    if (this.requestToAbort || signal.aborted) {
      this.setStatus("aborted");
      await this.log("aborted");
      this.touch();
      return "aborted";
    }

    let result;
    try {
      result = await ffmpeg.run(request, signal);
    } catch (error) {
      if (this.isAbortError(error) || this.requestToAbort || signal.aborted) {
        this.setStatus("aborted");
        await this.log("aborted");
        this.touch();
        return "aborted";
      }
      const message = error instanceof Error ? error.message : String(error);
      this.errorMessage = message;
      await this.log(message);
      this.setStatus("failed");
      this.touch();
      return "failed";
    }

    if (this.requestToAbort || signal.aborted) {
      this.setStatus("aborted");
      await this.log("aborted");
      this.touch();
      return "aborted";
    }

    if (result.exitCode !== 0) {
      this.errorMessage =
        result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
      await this.log(this.errorMessage);
      this.setStatus("failed");
      this.touch();
      return "failed";
    }

    return result;
  }

  private async cleanupPassLog(passLogPath: string): Promise<void> {
    try {
      await this.ports.fs.deleteFile(passLogPath);
    } catch {
      // best-effort
    }
  }

  /** Sync so progress is applied before the host `run` promise resolves. */
  private applyStderrLine(line: string): void {
    void this.log(line);

    if (this.totalSeconds === undefined) {
      const duration = parseDurationSeconds(line);
      if (duration != null) {
        this.totalSeconds = duration;
      }
    }

    const parsed = parseFfmpegProgressLine(line);
    if (!parsed || this.totalSeconds === undefined) {
      this.touch();
      return;
    }

    const { progress, etaSeconds } = computeFfmpegProgress({
      currentSeconds: parsed.currentSeconds,
      totalSeconds: this.totalSeconds,
      speedMultiplier: parsed.speedMultiplier,
      mapStart: this.progressMapStart,
      mapEnd: this.progressMapEnd,
    });
    this.setProgress(progress);
    if (etaSeconds !== undefined) {
      this.etaSeconds = etaSeconds;
    }
    this.touch();
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }

  private isAbortError(error: unknown): boolean {
    if (error instanceof Error && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}
