import type { AppContext, PlatformPorts } from "../types";
import type { VideoCaptionerPort } from "../ports/VideoCaptionerPort";
import {
  buildVideoCaptionerSynthesizeArgs,
  type VideoCaptionerSynthesizeInput,
} from "../whitelistedCmd/videocaptioner";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { SynthesizeSubtitleJobSnapshot } from "./types";

export interface SynthesizeSubtitleJobOptions {
  folder: string;
  videoPath: string;
  subtitlePath: string;
  title?: string;
  subtitleMode?: VideoCaptionerSynthesizeInput["subtitleMode"];
  quality?: VideoCaptionerSynthesizeInput["quality"];
  style?: string;
  renderMode?: VideoCaptionerSynthesizeInput["renderMode"];
  layout?: VideoCaptionerSynthesizeInput["layout"];
}

/**
 * Single-file videocaptioner synthesize. Log lines go to `${logDir}/${id}.log`.
 */
export class SynthesizeSubtitleJob extends AbstractJob {
  private readonly folder: string;
  private readonly videoPath: string;
  private readonly subtitlePath: string;
  private readonly title: string | undefined;
  private readonly subtitleMode: VideoCaptionerSynthesizeInput["subtitleMode"];
  private readonly quality: VideoCaptionerSynthesizeInput["quality"];
  private readonly style: string | undefined;
  private readonly renderMode: VideoCaptionerSynthesizeInput["renderMode"];
  private readonly layout: VideoCaptionerSynthesizeInput["layout"];

  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: SynthesizeSubtitleJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "synthesize-subtitle",
    });
    this.folder = options.folder.trim();
    this.videoPath = options.videoPath.trim();
    this.subtitlePath = options.subtitlePath.trim();
    this.title = options.title?.trim() || undefined;
    this.subtitleMode = options.subtitleMode;
    this.quality = options.quality;
    this.style = options.style?.trim() || undefined;
    this.renderMode = options.renderMode;
    this.layout = options.layout;
  }

  toJSON(): SynthesizeSubtitleJobSnapshot {
    return {
      kind: "synthesize-subtitle",
      id: this.id,
      type: "synthesize-subtitle",
      folder: this.folder,
      videoPath: this.videoPath,
      subtitlePath: this.subtitlePath,
      ...(this.title !== undefined ? { title: this.title } : {}),
      ...(this.subtitleMode !== undefined ? { subtitleMode: this.subtitleMode } : {}),
      ...(this.quality !== undefined ? { quality: this.quality } : {}),
      ...(this.style !== undefined ? { style: this.style } : {}),
      ...(this.renderMode !== undefined ? { renderMode: this.renderMode } : {}),
      ...(this.layout !== undefined ? { layout: this.layout } : {}),
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

      const args = buildVideoCaptionerSynthesizeArgs({
        videoPath: this.videoPath,
        subtitlePath: this.subtitlePath,
        subtitleMode: this.subtitleMode,
        quality: this.quality,
        style: this.style,
        renderMode: this.renderMode,
        layout: this.layout,
      });

      await this.log(`Started videocaptioner synthesize: ${this.videoPath}`);
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
      throw new Error("VideoCaptionerPort is required for SynthesizeSubtitleJob");
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
