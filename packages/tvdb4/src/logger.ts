/**
 * This logger is designed for logging library injection.
 * `packages/tvdb4` is a library which didn't have its own logging solution.
 * The user of this library injects a real logger instance.
 *
 * Signatures follow pino’s `LogFn` (string message or object bindings + optional message + interpolation args).
 */
export type LogFn = {
  (msg: string, ...args: unknown[]): void;
  (obj: object, msg?: string, ...args: unknown[]): void;
};

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
}

/** Default when `TVDBv4ClientOptions.logger` is omitted (no overhead). */
export const noopLogger: Logger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};
