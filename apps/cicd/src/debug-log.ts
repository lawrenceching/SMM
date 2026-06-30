import * as fs from 'node:fs';
import * as path from 'node:path';

export type DebugLogEvent = {
  ts: string;
  event: string;
  [key: string]: unknown;
};

export class DebugLog {
  private stream: fs.WriteStream | null = null;

  constructor(private readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  static forOutputDir(outputDir: string): DebugLog {
    return new DebugLog(path.join(outputDir, '_debug', 'events.jsonl'));
  }

  emit(event: string, data: Record<string, unknown> = {}): void {
    const line: DebugLogEvent = {
      ts: new Date().toISOString(),
      event,
      ...data,
    };
    const text = JSON.stringify(line);
    process.stderr.write(`[cicd-debug] ${text}\n`);
    this.stream?.write(`${text}\n`);
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}
