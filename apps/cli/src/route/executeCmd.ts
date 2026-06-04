import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../lib/logger';
import { resolvePtyModule, isPtyAvailable, getPtyUnavailableReason } from '../utils/pty';
import type { IPty } from '../utils/pty';
import { discoverFfmpeg, discoverFfprobe } from '../utils/Ffmpeg';
import { discoverYtdlp } from '../utils/Ytdlp';
import { discoverVideoCaptioner, resolveSpawnEnvForVideoCaptioner, type VideoCaptionerTranscribeResult } from '../utils/VideoCaptioner';
import { discoverQuickjs } from '../utils/QuickJS';
import {
  createCommandExecutionLogWriter,
} from './commandExecutionLog';
import { isCommandExecutionId, parseOptionalXCommandExecutionId } from './commandLog';
import {
  markCommandExecutionFinished,
  markCommandExecutionRunning,
  type CommandExecutionOutcome,
} from './commandExecutionRegistry';
import { parseFinishedFromSystemNote } from './commandExecutionLogStatus';

const COMMAND_WHITELIST = ['ffmpeg', 'ffprobe', 'yt-dlp', 'videocaptioner', 'qjs'] as const;

export type ExecuteCmdWhitelistedCommand = (typeof COMMAND_WHITELIST)[number];

const executeCmdRequestSchema = z.object({
  command: z.enum(COMMAND_WHITELIST, {
    message: 'command must be one of: ffmpeg, ffprobe, yt-dlp, videocaptioner'
  }),
  args: z.array(z.string())
    .max(100, 'args cannot exceed 100 items')
    .refine((args) => {
      return args.every(arg =>
        arg.length <= 2000 &&
        !/[\n\r\t\v\f\u0000]/.test(arg)
      );
    }, 'args contain invalid characters or exceed length limit')
    .optional()
    .default([]),
  /**
   * Run the command in a pseudo-terminal (ConPTY on Windows, unix98 PTY on POSIX).
   * Currently only meaningful for `yt-dlp`; ignored for other commands. Default false.
   */
  tty: z.boolean().optional().default(false),
});

type ExecuteCmdRequestBody = z.infer<typeof executeCmdRequestSchema>;

interface NdjsonStdoutStderrMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

interface NdjsonSystemMessage {
  type: 'system';
  data: {
    event: 'exit' | 'error' | 'timeout';
    code?: number | null;
    signal?: string | null;
    message?: string;
  };
}

interface NdjsonProgressMessage {
  type: 'progress';
  data: {
    percent: number;
    speed: number;
    eta: number | null;
    downloaded: number | null;
    total: number | null;
    status: 'downloading' | 'finished';
  };
}

type NdjsonMessage = NdjsonStdoutStderrMessage | NdjsonSystemMessage | NdjsonProgressMessage;

function encodeNdjson(message: NdjsonMessage): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(message) + '\n');
}

function argsIncludeFfmpegLocation(args: string[]): boolean {
  return args.includes('--ffmpeg-location');
}

/**
 * Progress template JSON passed to `yt-dlp --progress-template`.
 *
 * Each line yt-dlp emits on stdout (with `--newline`) will be one of these
 * JSON objects. Fields are documented in `yt-dlp-progress.md`.
 *
 * Why `percent` and `speed` are quoted: yt-dlp emits the literal text
 * `NA` (no quotes) for unavailable values such as percent or speed at
 * the start of a download, which is not valid JSON. Wrapping the
 * `%(progress._percent_json)s` and `%(progress.speed)r` placeholders
 * in double quotes makes yt-dlp emit `"NA"` (a valid JSON string) when
 * the value is missing, so the line is always parseable.
 *
 * `eta`, `downloaded_bytes`, and `total_bytes` are emitted unquoted
 * because yt-dlp only outputs them as numbers or the literal `NA`
 * (which we sanitize before parsing — see {@link sanitizeYtdlpProgressLine}).
 */
const YTDLP_PROGRESS_TEMPLATE =
  '{"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": %(progress.eta)r, "downloaded": %(progress.downloaded_bytes)r, "total": %(progress.total_bytes)r, "status": "%(progress.status)s"}';

function isYtdlpDownloadCommand(args: string[]): boolean {
  // Download invocations set an output template via --output.
  return args.includes('--output');
}

export function injectYtdlpProgressArgs(args: string[]): string[] {
  // Only inject if the caller hasn't already provided a progress template,
  // and only for download invocations (i.e. --output is present).
  if (args.includes('--progress-template') || args.includes('--newline')) {
    return args;
  }
  if (!isYtdlpDownloadCommand(args)) {
    return args;
  }
  return [...args, '--newline', '--progress-template', YTDLP_PROGRESS_TEMPLATE];
}

export function isYtdlpProgressJson(line: string): boolean {
  if (!line.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>;
    return typeof parsed.status === 'string';
  } catch {
    return false;
  }
}

/**
 * yt-dlp emits the literal text `NA` (no quotes) for unavailable values
 * of `eta`, `downloaded_bytes`, and `total_bytes` in the progress template.
 * This produces invalid JSON. We replace the value `NA` with `null` so
 * `JSON.parse` succeeds. The pattern is restricted to value position
 * (`: *NA` requires a preceding colon) so that the quoted string `"NA"`
 * emitted for `percent` and `speed` is not touched.
 */
function sanitizeYtdlpProgressLine(line: string): string {
  return line.replace(/: *NA\b/g, ':null');
}

/**
 * Convert a yt-dlp progress field value — a number, a numeric string
 * (e.g. `"62197.226..."`), the literal `"NA"`, or `null` after
 * sanitization — into a finite number, or `null` when the value is
 * not a usable number. Used for all progress fields so the parser is
 * robust to both quoted and unquoted formats.
 */
function parseProgressNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'NA' || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseYtdlpProgressLine(line: string): NdjsonProgressMessage['data'] | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const statusRaw = parsed.status;
  if (statusRaw !== 'downloading' && statusRaw !== 'finished') {
    return null;
  }
  const downloaded = parseProgressNumericValue(parsed.downloaded);
  const total = parseProgressNumericValue(parsed.total);

  // `percent` is often `"NA"` (a string) for resumed or freshly started
  // downloads, so fall back to downloaded/total when it is not a number.
  let percent = parseProgressNumericValue(parsed.percent);
  if (percent == null && downloaded != null && total != null && total > 0) {
    percent = (downloaded / total) * 100;
  }
  if (percent == null) percent = 0;

  const speed = parseProgressNumericValue(parsed.speed) ?? 0;
  const eta = parseProgressNumericValue(parsed.eta);

  return {
    percent,
    speed,
    eta,
    downloaded,
    total,
    status: statusRaw,
  };
}

export async function resolveSpawnArgsAndEnv(
  command: ExecuteCmdRequestBody['command'],
  args: string[],
  opts?: { tty?: boolean }
): Promise<{ args: string[]; env?: NodeJS.ProcessEnv }> {
  let spawnArgs = args;
  let env: NodeJS.ProcessEnv | undefined;
  const tty = opts?.tty === true;

  if (command === 'videocaptioner') {
    env = await resolveSpawnEnvForVideoCaptioner();
  }

  if (command === 'yt-dlp') {
    if (!argsIncludeFfmpegLocation(args)) {
      const ffmpegPath = await discoverFfmpeg();
      if (ffmpegPath) {
        spawnArgs = ['--ffmpeg-location', ffmpegPath, ...spawnArgs];
      }
    }
    // Inject --newline + --progress-template so progress is parseable.
    spawnArgs = injectYtdlpProgressArgs(spawnArgs);
    if (tty) {
      // When the child is attached to a real TTY (ConPTY on Windows), yt-dlp's
      // Python runtime uses line-buffered stdout natively, so
      // `PYTHONUNBUFFERED` is unnecessary. Skip it to keep the env clean.
    } else {
      // Force line-buffered stdout. yt-dlp is a Python application that
      // block-buffers stdout (typically 8KB) when its stdout is a pipe
      // (SMM's case via child_process.spawn), which delays progress lines
      // for many seconds — they only flush when the buffer fills or the
      // process exits. With PYTHONUNBUFFERED=1 each `\n` causes an
      // immediate flush, so progress arrives in real time. This matches
      // the line-buffered behavior yt-dlp uses when its stdout is a TTY.
      env = { ...(env ?? process.env), PYTHONUNBUFFERED: '1' };
    }
  }

  return { args: spawnArgs, env };
}

async function resolveCommandPath(command: ExecuteCmdRequestBody['command']): Promise<string | undefined> {
  switch (command) {
    case 'ffmpeg':
      return await discoverFfmpeg();
    case 'ffprobe':
      return await discoverFfprobe();
    case 'yt-dlp':
      return await discoverYtdlp();
    case 'videocaptioner':
      return await discoverVideoCaptioner();
    case 'qjs':
      return await discoverQuickjs();
    default:
      return undefined;
  }
}

const DEFAULT_TIMEOUT_MS = 300000;

/** Only one yt-dlp executeCmd stream/spawn at a time (parallel ffmpeg/ffprobe OK). */
let ytDlpExecuteCmdChain: Promise<void> = Promise.resolve();

function enqueueYtDlpExecuteCmd<T>(task: () => Promise<T>): Promise<T> {
  const next = ytDlpExecuteCmdChain.then(() => task());
  ytDlpExecuteCmdChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function handleExecuteCmd(app: Hono) {
  app.post('/api/executeCmd', async (c) => {
    const httpRequestId = c.get('requestId');

    try {
      const rawBody = await c.req.json();
      const parseResult = executeCmdRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const message = parseResult.error.issues[0]?.message ?? 'Invalid request';
        logger.warn({ requestId: httpRequestId, error: message }, '[executeCmd] validation failed');
        return c.json({ error: message }, 400);
      }

      const { command, args, tty } = parseResult.data;

      const executablePath = await resolveCommandPath(command);
      if (!executablePath) {
        logger.error({ requestId: httpRequestId, command }, '[executeCmd] executable not found');
        return c.json({ error: `${command} executable not found` }, 404);
      }

      const timeoutHeader = c.req.header('X-Timeout');
      const timeoutMs = timeoutHeader ? parseInt(timeoutHeader, 10) : DEFAULT_TIMEOUT_MS;
      const validTimeout = isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;

      const { id: clientExecutionId, error: headerError } = parseOptionalXCommandExecutionId(
        c.req.header('X-Command-Execution-Id'),
      );
      if (headerError) {
        return c.json({ error: headerError }, 400);
      }

      const commandExecutionId = clientExecutionId ?? crypto.randomUUID();
      const cmdLog = await createCommandExecutionLogWriter(commandExecutionId);
      markCommandExecutionRunning(commandExecutionId, command);

      // `tty: true` is only honored for `yt-dlp`. Other commands ignore it.
      // If PTY is unavailable (e.g. node-pty prebuilt missing), we silently
      // fall back to pipe spawn — see [executeCmd] PTY fallback log.
      const requestedTty = tty === true;
      const usePty = requestedTty && command === 'yt-dlp' && isPtyAvailable();
      if (requestedTty && command === 'yt-dlp' && !usePty) {
        const reason = getPtyUnavailableReason();
        logger.warn(
          { commandExecutionId, command, reason: reason ?? 'unknown' },
          '[executeCmd] PTY requested for yt-dlp but unavailable; falling back to pipe spawn'
        );
      }

      const { args: spawnArgs, env: spawnEnv } = await resolveSpawnArgsAndEnv(command, args, {
        tty: usePty,
      });

      logger.info(
        {
          requestId: httpRequestId,
          commandExecutionId,
          commandLogPath: cmdLog.logRelativePath,
          command,
          argsCount: args.length,
          timeoutMs: validTimeout,
          requestedTty,
          usePty,
        },
        '[executeCmd] starting command execution'
      );

      const stream = new ReadableStream({
        async start(controller) {
          const runPipeline = async () => {
            await new Promise<void>((resolve) => {
              let pipelineSettled = false;
              const settlePipeline = () => {
                if (pipelineSettled) return;
                pipelineSettled = true;
                resolve();
              };

              let child: ChildProcess | IPty | null = null;
              let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
              let isClosed = false;
              let cmdLogEnded = false;
              // Buffer for the trailing partial line from stdout. yt-dlp may
              // emit a progress JSON line split across multiple chunks.
              let stdoutLineBuffer = '';

              const safeEndCmdLog = (note?: string) => {
                if (cmdLogEnded) return;
                cmdLogEnded = true;
                if (note) {
                  cmdLog.appendSystemNote(note);
                }
                cmdLog.close();
              };

              const safeEnqueue = (data: Uint8Array) => {
                if (!isClosed) {
                  try {
                    controller.enqueue(data);
                  } catch (enqueueError) {
                    logger.error(
                      { requestId: httpRequestId, commandExecutionId, error: enqueueError },
                      '[executeCmd] failed to enqueue data'
                    );
                  }
                }
              };

              const safeClose = () => {
                if (!isClosed) {
                  isClosed = true;
                  if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                  }
                  try {
                    controller.close();
                  } catch (closeError) {
                    logger.error(
                      { requestId: httpRequestId, commandExecutionId, error: closeError },
                      '[executeCmd] failed to close stream'
                    );
                  }
                  queueMicrotask(settlePipeline);
                  return;
                }
                settlePipeline();
              };

              const cleanupChild = () => {
                if (!child) return;
                if ('stdout' in child) {
                  // ChildProcess has .stdout/.stderr streams.
                  child.removeAllListeners();
                  child.stdout?.removeAllListeners();
                  child.stderr?.removeAllListeners();
                } else {
                  // IPty: no removeAllListeners API. Best effort — drop
                  // reference so handlers can be GC'd.
                }
                child = null;
              };

              /**
               * Whether the child has already exited. Works for both
               * ChildProcess (exitCode/signalCode) and IPty (no exit signal,
               * we track via `ptyExited`).
               */
              let ptyExited = false;
              const isChildRunning = (): boolean => {
                if (!child) return false;
                if ('exitCode' in child) {
                  // ChildProcess
                  return child.exitCode === null && child.signalCode === null;
                }
                // IPty
                return !ptyExited;
              };
              const killChild = (signal?: string) => {
                if (!child) return;
                if ('kill' in child) {
                  // ChildProcess expects a NodeJS signal; IPty accepts any string.
                  // The union is `string | NodeJS.Signals`, so cast is safe.
                  try { child.kill(signal as never); } catch { /* ignore */ }
                }
              };

              /**
               * Flush any trailing partial line buffered from the child
               * output. Used both for the final flush on exit and by
               * the per-chunk line splitter.
               */
              const flushStdoutLineBuffer = () => {
                if (stdoutLineBuffer.length === 0) return;
                const remaining = stdoutLineBuffer;
                stdoutLineBuffer = '';
                if (isYtdlpProgressJson(remaining)) {
                  const parsed = parseYtdlpProgressLine(remaining);
                  if (parsed) {
                    safeEnqueue(encodeNdjson({ type: 'progress', data: parsed }));
                    return;
                  }
                }
                safeEnqueue(encodeNdjson({ type: 'stdout', data: remaining }));
              };

              /**
               * Handle child process exit (both PTY and pipe).
               */
              const handleExit = (code: number | null, signal: string | null) => {
                flushStdoutLineBuffer();
                logger.info(
                  {
                    requestId: httpRequestId,
                    commandExecutionId,
                    commandLogPath: cmdLog.logRelativePath,
                    command,
                    exitCode: code,
                    signal,
                  },
                  '[executeCmd] command finished'
                );
                const exitNote = `exit code=${code ?? 'null'} signal=${signal ?? 'null'}`;
                const outcome: CommandExecutionOutcome = code === 0 ? 'success' : 'failure';
                markCommandExecutionFinished(commandExecutionId, {
                  outcome,
                  exitCode: code,
                  signal: signal ?? null,
                  systemNote: exitNote,
                });
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'exit', code, signal }
                }));
                safeEndCmdLog(exitNote);
                queueMicrotask(() => {
                  safeClose();
                  cleanupChild();
                });
              };

              /**
               * Handle child process spawn/runtime error (pipe path only;
               * PTY does not emit a separate 'error' event).
               */
              const handleError = (err: Error) => {
                logger.error(
                  {
                    requestId: httpRequestId,
                    commandExecutionId,
                    command,
                    error: err.message,
                  },
                  '[executeCmd] command execution error'
                );
                const errorNote = `process error: ${err.message}`;
                markCommandExecutionFinished(commandExecutionId, {
                  outcome: 'failure',
                  systemNote: errorNote,
                });
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'error', message: err.message }
                }));
                safeEndCmdLog(errorNote);
                queueMicrotask(() => {
                  safeClose();
                  cleanupChild();
                });
              };

              try {
                if (usePty) {
                  const ptyMod = resolvePtyModule();
                  if (!ptyMod) {
                    // Should not happen: usePty implies pty availability,
                    // but guard anyway.
                    throw new Error('node-pty is not available');
                  }
                  child = ptyMod.spawn(executablePath, spawnArgs, {
                    name: 'xterm-256color',
                    cols: 120,
                    rows: 30,
                    cwd: process.cwd(),
                    env: spawnEnv ?? process.env,
                    useConpty: true,
                  });

                  cmdLog.appendSystemNote(
                    `pty spawn command=${command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)} pid=${(child as IPty).pid}`
                  );

                  child.onData((data: string) => {
                    cmdLog.appendStdout(data);
                    stdoutLineBuffer += data;
                    const lines = stdoutLineBuffer.split('\n');
                    stdoutLineBuffer = lines.pop() ?? '';
                    for (const line of lines) {
                      if (isYtdlpProgressJson(line)) {
                        const parsed = parseYtdlpProgressLine(line);
                        if (parsed) {
                          safeEnqueue(encodeNdjson({ type: 'progress', data: parsed }));
                          continue;
                        }
                      }
                      safeEnqueue(encodeNdjson({ type: 'stdout', data: line + '\n' }));
                    }
                  });

                  child.onExit(({ exitCode, signal }) => {
                    ptyExited = true;
                    flushStdoutLineBuffer();
                    handleExit(exitCode, signal != null ? String(signal) : null);
                  });
                } else {
                  child = spawn(executablePath, spawnArgs, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: false,
                    ...(spawnEnv ? { env: spawnEnv } : {}),
                  });

                  cmdLog.appendSystemNote(
                    `spawn command=${command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)}`
                  );

                  child.stdout?.on('data', (data: Buffer) => {
                    const text = data.toString();
                    cmdLog.appendStdout(text);
                    // Split into lines so we can route progress JSON to a
                    // dedicated `progress` NDJSON message.
                    // We track incomplete trailing lines in a buffer.
                    stdoutLineBuffer += text;
                    const lines = stdoutLineBuffer.split('\n');
                    stdoutLineBuffer = lines.pop() ?? '';
                    for (const line of lines) {
                      if (isYtdlpProgressJson(line)) {
                        const parsed = parseYtdlpProgressLine(line);
                        if (parsed) {
                          safeEnqueue(encodeNdjson({ type: 'progress', data: parsed }));
                          continue;
                        }
                      }
                      safeEnqueue(encodeNdjson({ type: 'stdout', data: line + '\n' }));
                    }
                  });

                  child.stderr?.on('data', (data: Buffer) => {
                    const text = data.toString();
                    cmdLog.appendStderr(text);
                    safeEnqueue(encodeNdjson({
                      type: 'stderr',
                      data: text
                    }));
                  });

                  child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                    ptyExited = true;
                    handleExit(code, signal ?? null);
                  });

                  child.on('error', (err: Error) => {
                    handleError(err);
                  });
                }

                timeoutTimer = setTimeout(() => {
                  if (isChildRunning()) {
                    logger.warn(
                      {
                        requestId: httpRequestId,
                        commandExecutionId,
                        command,
                        timeoutMs: validTimeout,
                      },
                      '[executeCmd] command timed out'
                    );
                    const timeoutNote = `timeout after ${validTimeout}ms`;
                    markCommandExecutionFinished(commandExecutionId, {
                      outcome: 'failure',
                      systemNote: timeoutNote,
                    });
                    safeEndCmdLog(timeoutNote);
                    safeEnqueue(encodeNdjson({
                      type: 'system',
                      data: { event: 'timeout' }
                    }));
                    killChild('SIGTERM');
                  }
                }, validTimeout);

                const abortHandler = () => {
                  logger.warn(
                    {
                      requestId: httpRequestId,
                      commandExecutionId,
                      command,
                    },
                    '[executeCmd] client disconnected, terminating process'
                  );
                  if (isChildRunning()) {
                    killChild('SIGTERM');
                  }
                  const abortNote = 'client disconnected (abort)';
                  markCommandExecutionFinished(commandExecutionId, {
                    outcome: 'failure',
                    exitCode: null,
                    signal: 'SIGTERM',
                    systemNote: abortNote,
                  });
                  safeEnqueue(encodeNdjson({
                    type: 'system',
                    data: { event: 'exit', code: null, signal: 'SIGTERM' },
                  }));
                  safeEndCmdLog(abortNote);
                  queueMicrotask(() => {
                    safeClose();
                    cleanupChild();
                  });
                };

                c.req.raw.signal.addEventListener('abort', abortHandler, { once: true });

              } catch (err) {
                logger.error(
                  { requestId: httpRequestId, commandExecutionId, command, error: err },
                  '[executeCmd] failed to spawn command'
                );
                const spawnNote = `spawn failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
                markCommandExecutionFinished(commandExecutionId, {
                  outcome: 'failure',
                  systemNote: spawnNote,
                });
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
                }));
                safeEndCmdLog(spawnNote);
                queueMicrotask(() => {
                  safeClose();
                  cleanupChild();
                });
              }
            });
          };

          if (command === 'yt-dlp') {
            await enqueueYtDlpExecuteCmd(runPipeline);
          } else {
            await runPipeline();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Connection': 'close',
          'Cache-Control': 'no-store',
          'X-Command-Execution-Id': commandExecutionId,
          'X-Command-Log-Path': cmdLog.logRelativePath,
          'X-Resolved-Executable-Path': executablePath,
        },
      });

    } catch (error) {
      logger.error(
        { requestId: httpRequestId, error },
        '[executeCmd] route error'
      );
      return c.json(
        { error: 'Failed to process execute command request' },
        500
      );
    }
  });
}

/**
 * Same executable resolution and spawn rules as POST `/api/executeCmd`, but waits for exit
 * (no NDJSON stream). Used by routes that need a JSON response instead of streaming.
 */
export async function runWhitelistedCommandSync(input: {
  command: ExecuteCmdWhitelistedCommand;
  args: string[];
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  logMeta?: Record<string, unknown>;
  /** When set and valid UUID v4, used as command log directory id. */
  executionId?: string;
}): Promise<VideoCaptionerTranscribeResult> {
  const executablePath = await resolveCommandPath(input.command);
  if (!executablePath) {
    return { error: `${input.command} executable not found` };
  }

  const { args: spawnArgs, env: mergedEnv } = await resolveSpawnArgsAndEnv(input.command, input.args);
  const spawnEnv = input.env ?? mergedEnv;

  const commandForLog = [executablePath, ...spawnArgs]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(' ');

  const run = async (): Promise<VideoCaptionerTranscribeResult> => {
    const writerId =
      input.executionId !== undefined && isCommandExecutionId(input.executionId)
        ? input.executionId.trim()
        : undefined;
    const cmdLog = await createCommandExecutionLogWriter(writerId);
    markCommandExecutionRunning(cmdLog.executionId, input.command);

    const withCorrelation = (result: VideoCaptionerTranscribeResult): VideoCaptionerTranscribeResult => ({
      ...result,
      executionId: cmdLog.executionId,
      logRelativePath: cmdLog.logRelativePath,
    });

    logger.info(
      {
        ...input.logMeta,
        command: input.command,
        executablePath,
        args: input.args,
        commandLine: commandForLog,
        timeoutMs: input.timeoutMs,
        commandExecutionId: cmdLog.executionId,
        commandLogPath: cmdLog.logRelativePath,
      },
      '[executeCmd] synchronous whitelisted command'
    );
    let cmdLogEnded = false;
    const safeEndCmdLog = (note?: string) => {
      if (cmdLogEnded) return;
      cmdLogEnded = true;
      if (note) {
        cmdLog.appendSystemNote(note);
      }
      cmdLog.close();
    };

    try {
      const child = spawn(executablePath, spawnArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        ...(spawnEnv ? { env: spawnEnv } : {}),
      });

      cmdLog.appendSystemNote(
        `sync spawn command=${input.command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)} commandLine=${commandForLog}`
      );

      return await new Promise<VideoCaptionerTranscribeResult>((resolve) => {
        let settled = false;
        let stderrOutput = '';
        const finish = (result: VideoCaptionerTranscribeResult, logNote?: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (logNote) {
            const parsed = parseFinishedFromSystemNote(logNote);
            if (parsed) {
              markCommandExecutionFinished(cmdLog.executionId, {
                ...parsed,
                systemNote: logNote,
              });
            } else {
              markCommandExecutionFinished(cmdLog.executionId, {
                outcome: result.success ? 'success' : 'failure',
                exitCode: result.success ? 0 : null,
                systemNote: logNote,
              });
            }
            safeEndCmdLog(logNote);
          } else {
            markCommandExecutionFinished(cmdLog.executionId, {
              outcome: result.success ? 'success' : 'failure',
              exitCode: result.success ? 0 : null,
            });
            safeEndCmdLog();
          }
          resolve(withCorrelation(result));
        };

        const timeoutId = setTimeout(() => {
          try {
            child.kill();
          } catch {
            // ignore
          }
          finish(
            { error: `${input.command} timed out after ${input.timeoutMs}ms` },
            `timeout after ${input.timeoutMs}ms`
          );
        }, input.timeoutMs);

        child.once('error', (error) => {
          finish(
            {
              error: `failed to run ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
            },
            `process error: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        });

        child.once('close', (code) => {
          if (code === 0) {
            finish({ success: true }, `exit code=${code}`);
            return;
          }
          const trimmedStderr = stderrOutput.trim();
          const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : '';
          logger.warn(
            {
              command: input.command,
              commandExecutionId: cmdLog.executionId,
              commandLogPath: cmdLog.logRelativePath,
              exitCode: code,
              stderr: trimmedStderr.slice(0, 4000),
              stderrTruncated: trimmedStderr.length > 4000,
              ...input.logMeta,
            },
            '[executeCmd] synchronous command exited with non-zero code'
          );
          finish(
            { error: `${input.command} exited with code ${code ?? 'unknown'}${stderrSuffix}` },
            `exit code=${code ?? 'null'} stderr preview in application log`
          );
        });

        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStdout(chunk);
        });

        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStderr(chunk);
          stderrOutput += String(chunk);
        });
      });
    } catch (error) {
      const spawnNote = `spawn failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      markCommandExecutionFinished(cmdLog.executionId, {
        outcome: 'failure',
        systemNote: spawnNote,
      });
      safeEndCmdLog(spawnNote);
      logger.error(
        {
          error,
          command: input.command,
          commandExecutionId: cmdLog.executionId,
          ...input.logMeta,
        },
        '[executeCmd] failed to spawn synchronous command'
      );
      return withCorrelation({
        error: `failed to start ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  };

  if (input.command === 'yt-dlp') {
    return enqueueYtDlpExecuteCmd(run);
  }
  return run();
}
