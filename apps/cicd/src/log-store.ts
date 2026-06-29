import * as fs from 'node:fs';
import * as path from 'node:path';

export class LineBuffer {
  private buffer = '';

  push(chunk: string, onLine: (line: string) => void): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, idx);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      onLine(line);
      this.buffer = this.buffer.slice(idx + 1);
    }
  }

  flush(onLine: (line: string) => void): void {
    if (this.buffer.length > 0) {
      onLine(this.buffer);
      this.buffer = '';
    }
  }
}

export type Stream = 'stdout' | 'stderr';

export class LogStore {
  private writers = new Map<string, fs.WriteStream>();
  private buffers = new Map<string, { stdout: LineBuffer; stderr: LineBuffer }>();

  constructor(private baseDir: string) {}

  registerSource(name: string): void {
    const filePath = path.join(this.baseDir, `${name}.jsonl`);
    this.writers.set(name, fs.createWriteStream(filePath, { flags: 'w' }));
    this.buffers.set(name, {
      stdout: new LineBuffer(),
      stderr: new LineBuffer(),
    });
  }

  appendChunk(source: string, stream: Stream, chunk: Buffer): void {
    const writer = this.writers.get(source);
    const buffers = this.buffers.get(source);
    if (!writer || !buffers) return;

    buffers[stream].push(chunk.toString('utf8'), (line) => {
      this.writeEntry(writer, stream, line);
    });
  }

  private writeEntry(writer: fs.WriteStream, stream: Stream, message: string): void {
    const entry = { timestamp: Date.now(), stream, message };
    writer.write(JSON.stringify(entry) + '\n');
  }

  async close(): Promise<void> {
    // Flush all buffers before closing writers.
    for (const [source, buffers] of this.buffers) {
      const writer = this.writers.get(source);
      if (!writer) continue;
      buffers.stdout.flush((line) => this.writeEntry(writer, 'stdout', line));
      buffers.stderr.flush((line) => this.writeEntry(writer, 'stderr', line));
    }

    await Promise.all(
      Array.from(this.writers.values()).map(
        (w) =>
          new Promise<void>((resolve) => {
            w.end(() => resolve());
          }),
      ),
    );
  }
}