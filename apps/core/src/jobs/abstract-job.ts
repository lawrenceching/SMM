import type { AppContext, PlatformPorts } from "../types";
import type { JobStatus } from "./types";

interface JobMandatoryOptions {
  id: string;
  logDir: string;
  join: (...args: string[]) => string;
  printLogToConsole: boolean;
  type: string;
  callbacks: Callbacks;
}

interface JobOptionalOptions {
  type: string;
  id: string;
  printLogToConsole: boolean;
}

export type JobOptions = JobMandatoryOptions & Partial<JobOptionalOptions>;

export interface Callbacks {
  onLog?(message: string): void;
}

export abstract class AbstractJob {
  readonly logFilePath: string;
  readonly context: AppContext;
  readonly ports: PlatformPorts;
  private _progress: number = 0;
  private _status: JobStatus = "pending";
  protected requestToAbort: boolean = false;
  private aborted: boolean = false;
  private options: JobOptions;

  constructor(ctx: AppContext, ports: PlatformPorts, options: JobOptions) {
    this.context = ctx;
    this.ports = ports;
    this.options = {
      ...options,
      id: options.id ?? Date.now().toString(),
      printLogToConsole: options.printLogToConsole ?? false,
    };
    this.logFilePath = this.ports.fs.join(this.context.logDir, `${this.options.id}.log`);
  }

  get id(): string {
    return this.options.id;
  }

  get type(): string {
    return this.options.type;
  }

  protected setProgress(progress: number): void {
    if (progress < 0) {
      progress = 0;
    }
    if (progress > 100) {
      progress = 100;
    }
    this._progress = progress;
  }

  public progress(): number {
    return this._progress;
  }

  async start(): Promise<void> {
    if (this.aborted) {
      throw new Error("Job already aborted");
    }

    await this.log(`${this.id} started`);
    this.setProgress(0);
    await this.run();
    this.setProgress(100);
    await this.log(`${this.id} completed`);
  }

  abstract run(): Promise<void>;

  abstract abort(): Promise<void>;

  protected setStatus(status: JobStatus): void {
    this._status = status;
  }

  get status(): JobStatus {
    return this._status;
  }

  /**
   * Mark the aborted flag to true.
   * The job will try it's best to abort the operation, but it's not guaranteed.
   */
  tryAbort(): void {
    this.requestToAbort = true;
  }

  /** Appends a job log line to the log file (and optionally the console). */
  async log(message: string): Promise<void> {
    this.options.callbacks?.onLog?.(message);
    if (this.options.printLogToConsole) {
      this.ports.logger?.info({}, `[${this.id}] ${message}`);
    }
    try {
      let prev = "";
      if (await this.ports.fs.exists(this.logFilePath)) {
        prev = await this.ports.fs.readTextFile(this.logFilePath);
      }
      const prefix = prev.length === 0 || prev.endsWith("\n") ? prev : `${prev}\n`;
      await this.ports.fs.writeTextFile(this.logFilePath, `${prefix}${message}\n`);
    } catch (error) {
      this.ports.logger?.warn({ err: error, name: this.id }, "job: failed to write job log file");
    }
  }
}
