import * as fs from 'node:fs';

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface SliceResult {
  lineCount: number;
  skippedLines: number;
}

export async function sliceLogFile(
  sourcePath: string,
  range: TimeRange,
  outputPath: string,
): Promise<SliceResult> {
  const content = await fs.promises.readFile(sourcePath, 'utf8');
  const lines = content.split('\n');

  const out: string[] = [];
  let lineCount = 0;
  let skippedLines = 0;

  for (const line of lines) {
    if (line.length === 0) continue;

    let entry: { timestamp?: number; message?: string };
    try {
      entry = JSON.parse(line);
    } catch {
      skippedLines++;
      continue;
    }

    if (typeof entry.timestamp !== 'number') {
      skippedLines++;
      continue;
    }

    if (entry.timestamp < range.startMs || entry.timestamp > range.endMs) {
      continue;
    }

    out.push(typeof entry.message === 'string' ? entry.message : '');
    lineCount++;
  }

  await fs.promises.writeFile(outputPath, out.length > 0 ? out.join('\n') + '\n' : '');
  return { lineCount, skippedLines };
}