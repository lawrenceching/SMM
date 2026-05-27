import fs from 'fs/promises';
import { resolveCommandMainLogPath } from './commandLog';
import type { CommandExecutionOutcome, CommandExecutionStatus } from './commandExecutionRegistry';

const TERMINAL_LOG_PATTERN =
  /client disconnected \(abort\)|\nexit code=|timeout after \d|process error:|spawn failed:/;

const TAIL_READ_BYTES = 16 * 1024;

export function parseFinishedFromSystemNote(note: string): {
  outcome: CommandExecutionOutcome;
  exitCode: number | null;
  signal: string | null;
} | null {
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (/exit code=0(?:\s|$)/.test(trimmed) || trimmed === 'exit code=0') {
    return { outcome: 'success', exitCode: 0, signal: null };
  }

  const exitMatch = trimmed.match(/exit code=(-?\d+|null)(?:\s+signal=(\S+))?/);
  if (exitMatch) {
    const codeRaw = exitMatch[1];
    const exitCode = codeRaw === 'null' ? null : Number.parseInt(codeRaw!, 10);
    const signalRaw = exitMatch[2];
    const signal = signalRaw == null || signalRaw === 'null' ? null : signalRaw;
    if (exitCode === 0) {
      return { outcome: 'success', exitCode: 0, signal };
    }
    return { outcome: 'failure', exitCode, signal };
  }

  if (
    trimmed.includes('client disconnected (abort)') ||
    trimmed.includes('timeout after') ||
    trimmed.includes('process error:') ||
    trimmed.includes('spawn failed:')
  ) {
    return { outcome: 'failure', exitCode: null, signal: null };
  }

  return null;
}

function lastSystemNoteFromLogText(raw: string): string | null {
  const header = /^--- system ts=[^\n]+ ---\n/gm;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = header.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const next = raw.slice(start).search(/\n--- stream=(stdout|stderr|system) ts=/);
    const body = next === -1 ? raw.slice(start) : raw.slice(start, start + next);
    last = body.trim();
  }
  return last;
}

export async function readCommandExecutionStatusFromLog(
  executionId: string,
): Promise<CommandExecutionStatus | null> {
  const logPath = resolveCommandMainLogPath(executionId);
  if (!logPath) return null;

  let raw: string;
  try {
    const fh = await fs.open(logPath, 'r');
    try {
      const st = await fh.stat();
      const size = st.size;
      if (size === 0) {
        return {
          executionId,
          found: true,
          phase: 'running',
        };
      }
      const readLen = Math.min(size, TAIL_READ_BYTES);
      const buf = Buffer.alloc(readLen);
      await fh.read(buf, 0, readLen, size - readLen);
      raw = buf.toString('utf8');
    } finally {
      await fh.close();
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw err;
  }

  if (!TERMINAL_LOG_PATTERN.test(raw)) {
    return {
      executionId,
      found: true,
      phase: 'running',
    };
  }

  const systemNote = lastSystemNoteFromLog(raw);
  const parsed = systemNote ? parseFinishedFromSystemNote(systemNote) : null;
  if (!parsed) {
    return {
      executionId,
      found: true,
      phase: 'running',
    };
  }

  return {
    executionId,
    found: true,
    phase: 'finished',
    outcome: parsed.outcome,
    exitCode: parsed.exitCode,
    signal: parsed.signal,
    systemNote: systemNote ?? undefined,
  };
}
