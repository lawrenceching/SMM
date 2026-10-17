import type { AppContext, PlatformPorts } from "../types";
import type { VideoCaptionerPort } from "../ports/VideoCaptionerPort";
import {
  buildTranslateSubtitleArgs,
  type TranslateLayout,
  type TranslateTranslator,
} from "../whitelistedCmd/videocaptioner";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { TranslateSubtitleJobSnapshot } from "./types";

export interface TranslateSubtitleJobOptions {
  folder: string;
  subtitlePath: string;
  mediaPath?: string;
  title?: string;
  translator: TranslateTranslator;
  targetLanguage: string;
  reflect?: boolean;
  layout?: TranslateLayout;
  /** Kept privately for argv only; never included in toJSON(). */
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

/**
 * Single-file videocaptioner subtitle translate. Log lines go to `${logDir}/${id}.log`.
 */
export class TranslateSubtitleJob extends AbstractJob {
  private readonly folder: string;
  private readonly subtitlePath: string;
  private readonly mediaPath: string | undefined;
  private readonly title: string | undefined;
  private readonly translator: TranslateTranslator;
  private readonly targetLanguage: string;
  private readonly reflect: boolean | undefined;
  private readonly layout: TranslateLayout | undefined;
  private readonly llm: { apiKey: string; apiBase?: string; model?: string } | undefined;

  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: TranslateSubtitleJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "translate-subtitle",
    });
    this.folder = options.folder.trim();
    this.subtitlePath = options.subtitlePath.trim();
    this.mediaPath = options.mediaPath?.trim() || undefined;
    this.title = options.title?.trim() || undefined;
    this.translator = options.translator;
    this.targetLanguage = options.targetLanguage.trim();
    this.reflect = options.reflect;
    this.layout = options.layout;
    this.llm = options.llm;
  }

  toJSON(): TranslateSubtitleJobSnapshot {
    return {
      kind: "translate-subtitle",
      id: this.id,
      type: "translate-subtitle",
      folder: this.folder,
      subtitlePath: this.subtitlePath,
      ...(this.mediaPath !== undefined ? { mediaPath: this.mediaPath } : {}),
      ...(this.title !== undefined ? { title: this.title } : {}),
      translator: this.translator,
      targetLanguage: this.targetLanguage,
      ...(this.reflect !== undefined ? { reflect: this.reflect } : {}),
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

      const args = buildTranslateSubtitleArgs({
        subtitlePath: this.subtitlePath,
        translator: this.translator,
        targetLanguage: this.targetLanguage,
        reflect: this.reflect,
        layout: this.layout,
        llm: this.llm,
      });

      await this.log(`Started videocaptioner translate: ${this.subtitlePath}`);
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
      throw new Error("VideoCaptionerPort is required for TranslateSubtitleJob");
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
