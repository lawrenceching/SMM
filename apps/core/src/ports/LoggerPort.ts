export interface LoggerPort {
  info(obj: unknown, msg: string): void;
  warn(obj: unknown, msg: string): void;
  error(obj: unknown, msg: string): void;
}
