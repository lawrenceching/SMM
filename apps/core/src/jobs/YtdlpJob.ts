import type { AppContext, PlatformPorts } from "../types";
import type { CommandPort } from "../ports/CommandPort";
import { classifyYtdlpError } from "../pipeline/ytdlp/classifyYtdlpError";
import { injectYtdlpProgressArgs, parseYtdlpProgressLine } from "../pipeline/ytdlp/progress";
import { buildYtDlpSimulatedError, parseTestYtDlpUrl } from "../pipeline/ytdlp/testLocal";
import {
  buildYtdlpCookiesFilePath,
  buildYtdlpDownloadArgs,
  validateYtdlpDownloadExtraArgs,
} from "../whitelistedCmd/ytdlp";
import { AbstractJob, type JobOptions } from "./abstract-job";
import type { YtdlpJobSnapshot } from "./types";

export interface YtdlpJobOptions {
  url: string;
  folder: string;
  title?: string;
  format?: string;
  extraArgs?: string[];
  cookiesText?: string;
  cookiesFromBrowser?: string;
  jsRuntime?: string;
  jsRuntimePath?: string;
  proxy?: string;
}

/**
 * Single-URL yt-dlp download. Log lines go to `${logDir}/${id}.log`.
 */
export class YtdlpJob extends AbstractJob {
  private readonly url: string;
  private readonly folder: string;
  private readonly title: string | undefined;
  private readonly format: string | undefined;
  private readonly extraArgs: string[] | undefined;
  private readonly cookiesText: string | undefined;
  private readonly cookiesFromBrowser: string | undefined;
  private readonly jsRuntime: string | undefined;
  private readonly jsRuntimePath: string | undefined;
  private readonly proxy: string | undefined;

  private speedBps: number | undefined;
  private etaSeconds: number | null | undefined;
  private errorType: string | undefined;
  private errorMessage: string | undefined;
  private cookiesFilePath: string | undefined;
  private abortController: AbortController | undefined;

  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: YtdlpJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "ytdlp",
    });
    this.url = options.url.trim();
    this.folder = options.folder.trim();
    this.title = options.title?.trim() || undefined;
    this.format = options.format?.trim() || undefined;
    this.extraArgs = options.extraArgs;
    this.cookiesText = options.cookiesText;
    this.cookiesFromBrowser = options.cookiesFromBrowser;
    this.jsRuntime = options.jsRuntime;
    this.jsRuntimePath = options.jsRuntimePath;
    this.proxy = options.proxy;
  }

  toJSON(): YtdlpJobSnapshot {
    return {
      kind: "ytdlp",
      id: this.id,
      type: "ytdlp",
      url: this.url,
      ...(this.title !== undefined ? { title: this.title } : {}),
      folder: this.folder,
      status: this.status,
      progress: this.progress(),
      ...(this.speedBps !== undefined ? { speedBps: this.speedBps } : {}),
      ...(this.etaSeconds !== undefined ? { etaSeconds: this.etaSeconds } : {}),
      ...(this.errorType !== undefined ? { errorType: this.errorType } : {}),
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

      const extraArgError = validateYtdlpDownloadExtraArgs(this.extraArgs);
      if (extraArgError) {
        this.errorType = "options-error";
        this.errorMessage = extraArgError;
        await this.log(extraArgError);
        this.setStatus("failed");
        this.touch();
        return;
      }

      if (parseTestYtDlpUrl(this.url)) {
        const stderr = buildYtDlpSimulatedError(this.url);
        await this.log(stderr);
        const classified = classifyYtdlpError({ stderr, stdout: "", exitCode: 1 });
        this.errorType = classified.type;
        this.errorMessage = stderr;
        this.setStatus("failed");
        this.touch();
        return;
      }

      const command = this.requireCommand();
      await this.writeCookiesIfNeeded();

      const args = injectYtdlpProgressArgs(
        buildYtdlpDownloadArgs({
          url: this.url,
          folder: this.folder,
          format: this.format,
          args: this.extraArgs,
          cookiesFile: this.cookiesFilePath,
          cookiesFromBrowser: this.cookiesFromBrowser,
          jsRuntime: this.jsRuntime,
          jsRuntimePath: this.jsRuntimePath,
          proxy: this.proxy,
        }),
      );

      await this.log(`Started yt-dlp download: ${this.url}`);
      this.abortController = new AbortController();
      if (this.requestToAbort) {
        this.abortController.abort();
      }

      let result;
      try {
        result = await command.run(
          {
            command: "yt-dlp",
            args,
            onStdoutLine: (line) => {
              this.applyStdoutLine(line);
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
        const classified = classifyYtdlpError({
          stderr: message,
          stdout: "",
          exitCode: null,
        });
        this.errorType = classified.type;
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
        const classified = classifyYtdlpError({
          stderr: result.stderr,
          stdout: result.stdout,
          exitCode: result.exitCode,
        });
        this.errorType = classified.type;
        this.errorMessage = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
        await this.log(this.errorMessage);
        this.setStatus("failed");
        this.touch();
        return;
      }

      // Terminal succeeded is set by AbstractJob.start after the lifecycle footer.
      this.touch();
    } finally {
      await this.deleteCookiesIfNeeded();
      this.abortController = undefined;
    }
  }

  override async abort(): Promise<void> {
    this.tryAbort();
    this.abortController?.abort();
  }

  private requireCommand(): CommandPort {
    const command = this.ports.command;
    if (command === undefined) {
      throw new Error("CommandPort is required for YtdlpJob");
    }
    return command;
  }

  private async writeCookiesIfNeeded(): Promise<void> {
    const text = this.cookiesText?.trim();
    if (!text) {
      return;
    }
    const path = buildYtdlpCookiesFilePath(this.context.userDataDir, this.id);
    const tempDir = this.ports.fs.join(this.context.userDataDir, "temp");
    await this.ports.fs.mkdir(tempDir);
    await this.ports.fs.writeTextFile(path, text);
    this.cookiesFilePath = path;
  }

  private async deleteCookiesIfNeeded(): Promise<void> {
    if (!this.cookiesFilePath) {
      return;
    }
    try {
      await this.ports.fs.deleteFile(this.cookiesFilePath);
    } catch (error) {
      this.ports.logger?.warn(
        { err: error, path: this.cookiesFilePath },
        "ytdlp: failed to delete managed cookies file",
      );
    }
    this.cookiesFilePath = undefined;
  }

  /** Sync so progress is applied before the host `run` promise resolves. */
  private applyStdoutLine(line: string): void {
    void this.log(line);
    const progress = parseYtdlpProgressLine(line);
    if (!progress) {
      return;
    }
    this.setProgress(progress.percent);
    this.speedBps = progress.speed;
    this.etaSeconds = progress.eta;
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
