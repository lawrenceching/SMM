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
 * Creates a per-execution log under {@link getLogDir}/commands/<executionId>/main.log.
 * Never throws: failures degrade to no-op writes; errors are logged.
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

  const appendChunk = (kind: 'stdout' | 'stderr', chunk: string | Buffer) => {
    const body = chunkToString(chunk);
    writeRaw(`--- stream=${kind} ts=${new Date().toISOString()} ---\n${body}`);
  };

  return {
    executionId,
    logDir,
    logFilePath,
    logRelativePath,
    appendStdout: (chunk) => appendChunk('stdout', chunk),
    appendStderr: (chunk) => appendChunk('stderr', chunk),
    appendSystemNote: (text) => {
      writeRaw(`--- system ts=${new Date().toISOString()} ---\n${text}\n`);
    },
    close: () => {
      closed = true;
    },
  };
}
