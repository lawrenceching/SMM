import type { AppContext, PlatformPorts } from "../types";
import type { FfmpegPort } from "../ports/FfmpegPort";
import {
  computeFfmpegProgress,
  parseDurationSeconds,
  parseFfmpegProgressLine,
} from "../pipeline/ffmpeg/progress";
import { buildFfmpegConvertArgs } from "../whitelistedCmd/ffmpeg";
import type {
  FfmpegConvertFormat,
  FfmpegConvertImageOptions,
  FfmpegConvertPreset,
} from "../whitelistedCmd/constants";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { FfmpegConvertJobSnapshot } from "./types";

export interface FfmpegConvertJobOptions {
  folder: string;
  inputPath: string;
  outputPath: string;
  /** Convert formats only; compress-* tokens are rejected at the assert/API layer. */
  outputFormat: FfmpegConvertFormat;
  preset: FfmpegConvertPreset;
  title?: string;
  imageOptions?: FfmpegConvertImageOptions;
}

/**
 * Single-file ffmpeg format conversion. Log lines go to `${logDir}/${id}.log`.
 */
export class FfmpegConvertJob extends AbstractJob {
  private readonly folder: string;
  private readonly inputPath: string;
  private readonly outputPath: string;
  private readonly outputFormat: FfmpegConvertFormat;
  private readonly preset: FfmpegConvertPreset;
  private readonly title: string | undefined;
  private readonly imageOptions: FfmpegConvertImageOptions | undefined;

  private etaSeconds: number | undefined;
  private totalSeconds: number | undefined;
  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: FfmpegConvertJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "ffmpeg-convert",
    });
    this.folder = options.folder.trim();
    this.inputPath = options.inputPath.trim();
    this.outputPath = options.outputPath.trim();
    this.outputFormat = options.outputFormat;
    this.preset = options.preset;
    this.title = options.title?.trim() || undefined;
    this.imageOptions = options.imageOptions;
  }

  toJSON(): FfmpegConvertJobSnapshot {
    return {
      kind: "ffmpeg-convert",
      id: this.id,
      type: "ffmpeg-convert",
      folder: this.folder,
      inputPath: this.inputPath,
      outputPath: this.outputPath,
      outputFormat: this.outputFormat,
      preset: this.preset,
      ...(this.title !== undefined ? { title: this.title } : {}),
      ...(this.imageOptions !== undefined ? { imageOptions: this.imageOptions } : {}),
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

      const args = buildFfmpegConvertArgs(
        this.inputPath,
        this.outputPath,
        this.outputFormat,
        this.preset,
        this.imageOptions,
      );

      await this.log(`Started ffmpeg convert: ${this.inputPath}`);
      this.abortController = new AbortController();
      if (this.requestToAbort) {
        this.abortController.abort();
      }

      let result;
      try {
        result = await ffmpeg.run(
          {
            command: "ffmpeg",
            args,
            onStderrLine: (line) => {
              this.applyStderrLine(line);
            },
          },
          this.abortController.signal,
        );
      } catch (error) {
        if (this.isAbortError(error) || this.requestToAbort || this.abortController.signal.aborted) {
          this.setStatus("aborted");
          await this.log("aborted");
          this.touch();
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.errorMessage = message;
        await this.log(message);
        this.setStatus("failed");
        this.touch();
        return;
      }

      if (this.requestToAbort || this.abortController.signal.aborted) {
        this.setStatus("aborted");
        await this.log("aborted");
        this.touch();
        return;
      }

      if (result.exitCode !== 0) {
        this.errorMessage =
          result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
        await this.log(this.errorMessage);
        this.setStatus("failed");
        this.touch();
        return;
      }

      this.setProgress(100);
      // Terminal succeeded is set by AbstractJob.start after the lifecycle footer.
      this.touch();
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
      throw new Error("FfmpegPort is required for FfmpegConvertJob");
    }
    return ffmpeg;
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
      mapStart: 0,
      mapEnd: 100,
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
