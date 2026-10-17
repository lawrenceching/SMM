import type { AppContext, PlatformPorts } from "../types";
import type { VideoCaptionerPort } from "../ports/VideoCaptionerPort";
import {
  buildVideoCaptionerProcessArgs,
  processJobDataToCliOptions,
  type TranscribeAsr,
  type TranscribeFormat,
  type TranslateLayout,
  type TranslateTranslator,
  type VideoCaptionerSynthesizeInput,
} from "../whitelistedCmd/videocaptioner";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { ProcessSubtitleJobSnapshot } from "./types";

export interface ProcessSubtitleJobOptions {
  folder: string;
  mediaPath: string;
  title?: string;
  asr?: TranscribeAsr;
  language?: string;
  wordTimestamps?: boolean;
  format?: TranscribeFormat;
  noOptimize?: boolean;
  noSplit?: boolean;
  noTranslate?: boolean;
  translator?: TranslateTranslator;
  targetLanguage?: string;
  reflect?: boolean;
  layout?: TranslateLayout;
  prompt?: string;
  /** Kept privately for argv only; never included in toJSON(). */
  llm?: { apiKey: string; apiBase?: string; model?: string };
  noSynthesize?: boolean;
  subtitleMode?: VideoCaptionerSynthesizeInput["subtitleMode"];
  quality?: VideoCaptionerSynthesizeInput["quality"];
  style?: string;
  renderMode?: VideoCaptionerSynthesizeInput["renderMode"];
  synthesizeLayout?: VideoCaptionerSynthesizeInput["layout"];
}

/**
 * Full videocaptioner `process` pipeline. Log lines go to `${logDir}/${id}.log`.
 */
export class ProcessSubtitleJob extends AbstractJob {
  private readonly folder: string;
  private readonly mediaPath: string;
  private readonly title: string | undefined;
  private readonly asr: TranscribeAsr | undefined;
  private readonly language: string | undefined;
  private readonly wordTimestamps: boolean | undefined;
  private readonly format: TranscribeFormat | undefined;
  private readonly noOptimize: boolean | undefined;
  private readonly noSplit: boolean | undefined;
  private readonly noTranslate: boolean | undefined;
  private readonly translator: TranslateTranslator | undefined;
  private readonly targetLanguage: string | undefined;
  private readonly reflect: boolean | undefined;
  private readonly layout: TranslateLayout | undefined;
  private readonly prompt: string | undefined;
  private readonly llm: { apiKey: string; apiBase?: string; model?: string } | undefined;
  private readonly noSynthesize: boolean | undefined;
  private readonly subtitleMode: VideoCaptionerSynthesizeInput["subtitleMode"];
  private readonly quality: VideoCaptionerSynthesizeInput["quality"];
  private readonly style: string | undefined;
  private readonly renderMode: VideoCaptionerSynthesizeInput["renderMode"];
  private readonly synthesizeLayout: VideoCaptionerSynthesizeInput["layout"];

  private errorMessage: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: ProcessSubtitleJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "process-subtitle",
    });
    this.folder = options.folder.trim();
    this.mediaPath = options.mediaPath.trim();
    this.title = options.title?.trim() || undefined;
    this.asr = options.asr;
    this.language = options.language?.trim() || undefined;
    this.wordTimestamps = options.wordTimestamps;
    this.format = options.format;
    this.noOptimize = options.noOptimize;
    this.noSplit = options.noSplit;
    this.noTranslate = options.noTranslate;
    this.translator = options.translator;
    this.targetLanguage = options.targetLanguage?.trim() || undefined;
    this.reflect = options.reflect;
    this.layout = options.layout;
    this.prompt = options.prompt?.trim() || undefined;
    this.llm = options.llm;
    this.noSynthesize = options.noSynthesize;
    this.subtitleMode = options.subtitleMode;
    this.quality = options.quality;
    this.style = options.style?.trim() || undefined;
    this.renderMode = options.renderMode;
    this.synthesizeLayout = options.synthesizeLayout;
  }

  toJSON(): ProcessSubtitleJobSnapshot {
    return {
      kind: "process-subtitle",
      id: this.id,
      type: "process-subtitle",
      folder: this.folder,
      mediaPath: this.mediaPath,
      ...(this.title !== undefined ? { title: this.title } : {}),
      ...(this.asr !== undefined ? { asr: this.asr } : {}),
      ...(this.language !== undefined ? { language: this.language } : {}),
      ...(this.wordTimestamps !== undefined ? { wordTimestamps: this.wordTimestamps } : {}),
      ...(this.format !== undefined ? { format: this.format } : {}),
      ...(this.noOptimize !== undefined ? { noOptimize: this.noOptimize } : {}),
      ...(this.noSplit !== undefined ? { noSplit: this.noSplit } : {}),
      ...(this.noTranslate !== undefined ? { noTranslate: this.noTranslate } : {}),
      ...(this.translator !== undefined ? { translator: this.translator } : {}),
      ...(this.targetLanguage !== undefined ? { targetLanguage: this.targetLanguage } : {}),
      ...(this.reflect !== undefined ? { reflect: this.reflect } : {}),
      ...(this.layout !== undefined ? { layout: this.layout } : {}),
      ...(this.prompt !== undefined ? { prompt: this.prompt } : {}),
      ...(this.noSynthesize !== undefined ? { noSynthesize: this.noSynthesize } : {}),
      ...(this.subtitleMode !== undefined ? { subtitleMode: this.subtitleMode } : {}),
      ...(this.quality !== undefined ? { quality: this.quality } : {}),
      ...(this.style !== undefined ? { style: this.style } : {}),
      ...(this.renderMode !== undefined ? { renderMode: this.renderMode } : {}),
      ...(this.synthesizeLayout !== undefined ? { synthesizeLayout: this.synthesizeLayout } : {}),
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

      const args = buildVideoCaptionerProcessArgs(
        this.mediaPath,
        processJobDataToCliOptions({
          asr: this.asr,
          language: this.language,
          wordTimestamps: this.wordTimestamps,
          format: this.format,
          noOptimize: this.noOptimize,
          noSplit: this.noSplit,
          noTranslate: this.noTranslate,
          translator: this.translator,
          targetLanguage: this.targetLanguage,
          reflect: this.reflect,
          layout: this.layout,
          prompt: this.prompt,
          llm: this.llm,
          noSynthesize: this.noSynthesize,
          subtitleMode: this.subtitleMode,
          quality: this.quality,
          style: this.style,
          renderMode: this.renderMode,
          synthesizeLayout: this.synthesizeLayout,
        }),
      );

      await this.log(`Started videocaptioner process: ${this.mediaPath}`);
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
      throw new Error("VideoCaptionerPort is required for ProcessSubtitleJob");
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
