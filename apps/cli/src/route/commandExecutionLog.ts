import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { getLogDir } from '../utils/config';
import { logger } from '../../lib/logger';

export type CommandExecutionLogWriter = {
  executionId: string;
  logDir: string;
  logFilePath: string;
  /** Relative to `getLogDir()`, POSIX-style (e.g. `commands/<uuid>/main.log`). */
  logRelativePath: string;
  appendStdout: (chunk: string | Buffer) => void;
  appendStderr: (chunk: string | Buffer) => void;
  appendSystemNote: (text: string) => void;
  close: () => void;
};

function chunkToString(chunk: string | Buffer): string {
  return typeof chunk === 'string' ? chunk : chunk.toString('utf8');
}

/**
 * Prefix every line of a chunk with a UTC ISO timestamp and a kind tag.
 * Kind is uppercased to mirror common log conventions (journald / pino).
 */
function formatPrefixedLines(kind: 'STDOUT' | 'STDERR' | 'SYSTEM', body: string, ts: string): string {
  // Normalize CRLF to LF so we don't produce empty lines on Windows chunks.
  const normalized = body.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  // Drop a single trailing empty entry produced by a final newline; preserve
  // internal blank lines as "TIMESTAMP [KIND] " (still parseable as a
  // continuation of the same segment).
  const last = lines[lines.length - 1];
  if (last === '' && lines.length > 1) lines.pop();
  if (lines.length === 0) return '';
  const out: string[] = [];
  for (const line of lines) {
    out.push(`${ts} [${kind}] ${line}`);
  }
  return out.join('\n') + '\n';
}

/**
 * Creates a per-execution log under {@link getLogDir}/commands/<executionId>/main.log.
 * Never throws: failures degrade to no-op writes; errors are logged.
 *
 * Each line of output is prefixed with a UTC ISO timestamp and a `[STDOUT]`
 * / `[STDERR]` / `[SYSTEM]` tag, so the file is grep-friendly and easy to
 * scan in a plain text editor. The parser in `commandLog.ts` reconstructs
 * segments by grouping consecutive same-tag lines.
 */
export async function createCommandExecutionLogWriter(
  executionId = crypto.randomUUID()
): Promise<CommandExecutionLogWriter> {
  const logRoot = getLogDir();
  const logDir = path.join(logRoot, 'commands', executionId);
  const logFilePath = path.join(logDir, 'main.log');
  const logRelativePath = path.posix.join('commands', executionId, 'main.log');

  let closed = false;

  const writeRaw = (text: string) => {
    if (closed) return;
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(logFilePath, text, { encoding: 'utf8' });
    } catch (err) {
      logger.warn({ err, executionId, logFilePath }, '[commandExecutionLog] append failed');
    }
  };

  const appendKind = (kind: 'STDOUT' | 'STDERR' | 'SYSTEM', text: string) => {
    if (!text) return;
    writeRaw(formatPrefixedLines(kind, text, new Date().toISOString()));
  };

  return {
    executionId,
    logDir,
    logFilePath,
    logRelativePath,
    appendStdout: (chunk) => appendKind('STDOUT', chunkToString(chunk)),
    appendStderr: (chunk) => appendKind('STDERR', chunkToString(chunk)),
    appendSystemNote: (text) => appendKind('SYSTEM', text),
    close: () => {
      closed = true;
    },
  };
}
