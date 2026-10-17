import type { AppContext, PlatformPorts } from "../types";
import type { VideoCaptionerPort } from "../ports/VideoCaptionerPort";
import {
  buildTranscribeSubtitleArgs,
  type TranscribeAsr,
  type TranscribeFormat,
} from "../whitelistedCmd/videocaptioner";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { TranscribeSubtitleJobSnapshot } from "./types";

export interface TranscribeSubtitleJobOptions {
  folder: string;
  mediaPath: string;
  title?: string;
  asr: TranscribeAsr;
  language?: string;
  wordTimestamps?: boolean;
  format?: TranscribeFormat;
}

/**
 * Single-file videocaptioner transcribe. Log lines go to `${logDir}/${id}.log`.
 */
export class TranscribeSubtitleJob extends AbstractJob {
  private readonly folder: string;
  private readonly mediaPath: string;
  private readonly title: string | undefined;
  private readonly asr: TranscribeAsr;
  private readonly language: string | undefined;
  private readonly wordTimestamps: boolean | undefined;
  private readonly format: TranscribeFormat | undefined;

  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: TranscribeSubtitleJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "transcribe-subtitle",
    });
    this.folder = options.folder.trim();
    this.mediaPath = options.mediaPath.trim();
    this.title = options.title?.trim() || undefined;
    this.asr = options.asr;
    this.language = options.language?.trim() || undefined;
    this.wordTimestamps = options.wordTimestamps;
    this.format = options.format;
  }

  toJSON(): TranscribeSubtitleJobSnapshot {
    return {
      kind: "transcribe-subtitle",
      id: this.id,
      type: "transcribe-subtitle",
      folder: this.folder,
      mediaPath: this.mediaPath,
      ...(this.title !== undefined ? { title: this.title } : {}),
      asr: this.asr,
      ...(this.language !== undefined ? { language: this.language } : {}),
      ...(this.wordTimestamps !== undefined ? { wordTimestamps: this.wordTimestamps } : {}),
      ...(this.format !== undefined ? { format: this.format } : {}),
      status: this.status,
      progress: this.progress(),
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

      let videoCaptioner: VideoCaptionerPort;
      try {
        videoCaptioner = this.requireVideoCaptioner();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.errorMessage = message;
        await this.log(message);
        this.setStatus("failed");
        this.touch();
        return;
      }

      const args = buildTranscribeSubtitleArgs({
        mediaPath: this.mediaPath,
        asr: this.asr,
        language: this.language,
        wordTimestamps: this.wordTimestamps,
        format: this.format,
      });

      await this.log(`Started videocaptioner transcribe: ${this.mediaPath}`);
      this.abortController = new AbortController();
      if (this.requestToAbort) {
        this.abortController.abort();
      }

      let result;
      try {
        result = await videoCaptioner.run(
          {
            args,
            onStdoutLine: (line) => {
              void this.log(line);
            },
            onStderrLine: (line) => {
              void this.log(line);
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

  private requireVideoCaptioner(): VideoCaptionerPort {
    const videoCaptioner = this.ports.videoCaptioner;
    if (videoCaptioner === undefined) {
      throw new Error("VideoCaptionerPort is required for TranscribeSubtitleJob");
    }
    return videoCaptioner;
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
