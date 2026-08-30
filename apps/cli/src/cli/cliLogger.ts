import type { LoggerPort } from '@smm/core'

/** CLI logger: necessary messages by default; structured payload only when verbose. */
export class CliLoggerAdapter implements LoggerPort {
  constructor(private readonly verbose: boolean) {}

  info(obj: unknown, msg: string): void {
    this.write(console.log, obj, msg)
  }

  warn(obj: unknown, msg: string): void {
    this.write(console.warn, obj, msg)
  }

  error(obj: unknown, msg: string): void {
    this.write(console.error, obj, msg)
  }

  private write(
    out: (message?: unknown, ...optionalParams: unknown[]) => void,
    obj: unknown,
    msg: string,
  ): void {
    if (this.verbose) {
      out(msg, JSON.stringify(obj))
    } else {
      out(msg)
    }
  }
}
