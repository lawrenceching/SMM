import type { LoggerPort } from "../ports/LoggerPort";

export class ConsoleLoggerAdapter implements LoggerPort {
  info(obj: unknown, msg: string): void {
    console.info(msg, obj);
  }
  warn(obj: unknown, msg: string): void {
    console.warn(msg, obj);
  }
  error(obj: unknown, msg: string): void {
    console.error(msg, obj);
  }
}

export class NoopLoggerAdapter implements LoggerPort {
  info(_obj: unknown, _msg: string): void {}
  warn(_obj: unknown, _msg: string): void {}
  error(_obj: unknown, _msg: string): void {}
}
