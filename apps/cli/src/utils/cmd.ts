/**
 * Core command execution utilities.
 *
 * This module is the framework-agnostic core that:
 *   1. Resolves an executable path for a whitelisted command.
 *   2. Resolves spawn args/env (e.g. injects `--ffmpeg-location` for yt-dlp).
 *   3. Spawns the process — either via PTY (ConPTY on Windows) or via
 *      `child_process.spawn` with a pipe.
 *   4. Streams stdout/stderr into a {@link CommandExecutionLogWriter}.
 *   5. Detects yt-dlp progress JSON lines and emits progress events.
 *   6. Tracks lifecycle (running → finished) in the execution registry.
 *   7. Honors a timeout and an optional AbortSignal.
 *
 * The HTTP route in `route/executeCmd.ts` is a thin shell that parses
 * the request, calls into this module, and pipes the event stream back
 * to the client as NDJSON.
 */
import { spawn, type ChildProcess } from 'child_process';
import stripAnsi from 'strip-ansi';
import { logger } from '../../lib/logger';
import {
  resolvePtyModule,
  isPtyAvailable,
  getPtyUnavailableReason,
  type IPty,
} from './pty';
import {
  discoverFfmpeg,
  discoverFfprobe,
} from './Ffmpeg';
import { discoverYtdlp } from './Ytdlp';
import {
  discoverVideoCaptioner,
  resolveSpawnEnvForVideoCaptioner,
  type VideoCaptionerTranscribeResult,
} from './VideoCaptioner';
import { discoverQuickjs } from './QuickJS';
import {
  createCommandExecutionLogWriter,
  type CommandExecutionLogWriter,
} from '../route/commandExecutionLog';
import {
  markCommandExecutionFinished,
  markCommandExecutionRunning,
  type CommandExecutionOutcome,
} from '../route/commandExecutionRegistry';
import { parseFinishedFromSystemNote } from '../route/commandExecutionLogStatus';
import { isCommandExecutionId } from '../route/commandLog'

// ─── Public types ────────────────────────────────────────────────────────────

export const COMMAND_WHITELIST = ['ffmpeg', 'ffprobe', 'yt-dlp', 'videocaptioner', 'qjs'] as const;

export type WhitelistedCommand = (typeof COMMAND_WHITELIST)[number];

export type ResolvedCommand =
  | { kind: 'ok'; command: WhitelistedCommand; executablePath: string }
  | { kind: 'not-found'; command: WhitelistedCommand };

/** Reason why the requested PTY mode could not be honored. */
export type PtyFallbackReason =
  | 'not-yt-dlp'
  | 'pty-unavailable'
  | { reason: string };

export interface RunCommandOptions {
  /** Pre-resolved executable path. Callers should run {@link resolveCommand} first. */
  executablePath: string;
  command: WhitelistedCommand;
  /** Original args from the caller. Will be enriched (e.g. `--ffmpeg-location`) before spawn. */
  args: string[];
  /**
   * Request PTY mode. Only honored for `yt-dlp`; other commands ignore this flag.
   * Falls back to pipe spawn when the platform doesn't support PTY.
   */
  tty?: boolean;
  /**
   * Pre-created log writer. The caller owns its lifecycle; the runner only
   * appends to it. Useful for correlating with a pre-known executionId.
   */
  cmdLog: CommandExecutionLogWriter;
  /** Hard timeout in ms. The process is sent SIGTERM when it expires. */
  timeoutMs?: number;
  /** Optional abort signal. SIGTERM is sent and the stream is closed on abort. */
  abortSignal?: AbortSignal;
  /**
   * Optional sink for streaming events. When provided, every line written
   * to the cmdLog is also forwarded to the sink (after line-splitting).
   * The HTTP route wires this to its NDJSON response stream.
   */
  sink?: Partial<RunCommandSink>;
}

export interface RunCommandSyncOptions {
  command: WhitelistedCommand;
  args: string[];
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  /** Extra fields merged into the `[executeCmd] synchronous whitelisted command` log line. */
  logMeta?: Record<string, unknown>;
  /**
   * If set and a valid UUID v4, used as the command log directory id.
   * Otherwise a fresh UUID is generated.
   */
  executionId?: string;
}

export interface RunCommandSyncResult extends VideoCaptionerTranscribeResult {
  executionId?: string;
  logRelativePath?: string;
}

/** Sink for the events a runner produces. The HTTP route wires this to NDJSON streaming. */
export interface RunCommandSink {
  stdout: (data: string) => void;
  stderr: (data: string) => void;
  progress: (data: YtdlpProgressData) => void;
  system: (event: SystemEvent) => void;
}

export type SystemEvent =
  | { event: 'exit'; code: number | null; signal: string | null }
  | { event: 'error'; message: string }
  | { event: 'timeout' };

export interface YtdlpProgressData {
  percent: number;
  speed: number;
  eta: number | null;
  downloaded: number | null;
  total: number | null;
  status: 'downloading' | 'finished';
}

export interface RunCommandResult {
  /** True if the request was honored (executable resolved, args prepared). */
  ok: boolean;
  /** Effective PTY mode after fallback. */
  usePty: boolean;
  /** Spawn args that were actually used (after injection). */
  spawnArgs: string[];
  /** Env that was passed to spawn. */
  spawnEnv?: NodeJS.ProcessEnv;
  /** Reason if PTY fallback was applied. */
  ptyFallback?: PtyFallbackReason;
}

// ─── Progress template & parsing ─────────────────────────────────────────────

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
 * `eta`, `downloaded`, and `total` are also wrapped in quotes for the
 * same reason: the literal `NA` would otherwise break JSON syntax. The
 * UI parser handles both quoted strings and unquoted numbers.
 */
const YTDLP_PROGRESS_TEMPLATE =
  '{"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": "%(progress.eta)r", "downloaded": "%(progress.downloaded_bytes)r", "total": "%(progress.total_bytes)r", "status": "%(progress.status)s"}';

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

function argsIncludeFfmpegLocation(args: string[]): boolean {
  return args.includes('--ffmpeg-location');
}

// ─── Test URL simulation ─────────────────────────────────────────────────────

/** HTTP status text map for common error codes. */
const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  407: 'Proxy Authentication Required',
  412: 'Precondition Failed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** Fixed video ID used in all test URL simulations. */
const TEST_VIDEO_ID = '1fSV26aE5Q';

/**
 * Parses a test URL in the format `https://test.local/{extractor}/http/{status_code}`.
 * Returns null if the URL is not a valid test URL.
 */
export function parseTestYtDlpUrl(url: string): { extractor: string; statusCode: number } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.host !== 'test.local') {
      return null;
    }
    // Path format: /{extractor}/http/{status_code}
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 3) return null;
    if (parts[1] !== 'http') return null;
    const statusCode = parseInt(parts[2], 10);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 999) return null;
    return { extractor: parts[0], statusCode };
  } catch {
    return null;
  }
}

/**
 * Checks if any argument is a test URL.
 */
export function isTestYtDlpUrl(args: string[]): boolean {
  return args.some((arg) => arg.startsWith('https://test.local'));
}

/**
 * Extracts the test URL from args, if present.
 */
export function extractTestYtDlpUrl(args: string[]): string | null {
  return args.find((arg) => arg.startsWith('https://test.local')) ?? null;
}

/**
 * Capitalizes an extractor name for display (e.g., 'bilibili' -> 'BiliBili').
 */
function capitalizeExtractorName(extractor: string): string {
  // Handle special cases for common extractors
  const knownNames: Record<string, string> = {
    bilibili: 'BiliBili',
    youtube: 'YouTube',
    niconico: 'Niconico',
  };
  if (knownNames[extractor.toLowerCase()]) {
    return knownNames[extractor.toLowerCase()];
  }
  // Default: capitalize first letter
  return extractor.charAt(0).toUpperCase() + extractor.slice(1);
}

/**
 * Builds a simulated yt-dlp error message for a given test URL.
 * The error format matches yt-dlp's actual error output.
 */
export function buildYtDlpSimulatedError(testUrl: string): string {
  const parsed = parseTestYtDlpUrl(testUrl);
  if (!parsed) {
    return `ERROR: Unable to download webpage: test URL parse failed`;
  }
  const { extractor, statusCode } = parsed;
  const statusText = HTTP_STATUS_TEXT[statusCode] ?? 'Unknown Error';
  const extractorDisplay = capitalizeExtractorName(extractor);
  return `ERROR: [${extractorDisplay}] ${TEST_VIDEO_ID}: Unable to download webpage: HTTP Error ${statusCode}: ${statusText} (caused by <HTTPError ${statusCode}: ${statusText}>)`;
}

/**
 * Builds the bash command arguments to simulate a yt-dlp error.
 * Uses `printf` to safely output the error message (avoids shell interpretation issues).
 * Outputs to stderr via >&2 and exits with code 1.
 */
export function buildTestYtDlpSimulatedSpawnArgs(errorMessage: string): string[] {
  // Escape special characters for safe inclusion in a double-quoted shell string.
  // Double quotes in bash interpret \$, \`, \\, \\, and \" as escape sequences.
  const escaped = errorMessage
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/"/g, '\\"');
  // Use printf to safely output the error message to stderr, then exit with code 1.
  const shellCmd = `printf "%s\\n" "${escaped}" >&2; exit 1`;
  return ['-c', shellCmd];
}

/** Replace bare `NA` tokens with `null` so JSON.parse succeeds. */
function sanitizeYtdlpProgressLine(line: string): string {
  return line.replace(/: *NA\b/g, ':null');
}

function parseProgressNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    if (value === 'NA' || value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Parse a single line that looks like yt-dlp progress JSON. Returns null
 * if the line is not progress JSON.
 */
export function parseYtdlpProgressLine(line: string): YtdlpProgressData | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>
  } catch {
    return null
  }
  const statusRaw = parsed.status
  if (statusRaw !== 'downloading' && statusRaw !== 'finished') {
    return null
  }
  const downloaded = parseProgressNumericValue(parsed.downloaded)
  const total = parseProgressNumericValue(parsed.total)
  // `percent` is often `"NA"` (a string) for resumed or freshly started
  // downloads, so fall back to downloaded/total when it is not a number.
  let percent: number | null = null
  if (typeof parsed.percent === 'string') {
    // yt-dlp's `_percent_json` field includes a trailing `%` (e.g. `"42.5%"`).
    // Strip it before numeric parsing.
    const cleaned = parsed.percent.replace(/%$/g, '').trim()
    percent = parseProgressNumericValue(cleaned)
  } else {
    percent = parseProgressNumericValue(parsed.percent)
  }
  if (percent == null && downloaded != null && total != null && total > 0) {
    percent = (downloaded / total) * 100
  }
  if (percent == null) percent = 0
  const speed = parseProgressNumericValue(parsed.speed) ?? 0
  const eta = parseProgressNumericValue(parsed.eta)
  return {
    percent,
    speed,
    eta,
    downloaded,
    total,
    status: statusRaw,
  }
}

/**
 * Fast shape check used to decide whether a stdout line is a yt-dlp progress
 * JSON object. Returns true iff the line is parseable JSON that contains a
 * string `status` field (the only required key in our progress template).
 */
export function isYtdlpProgressJson(line: string): boolean {
  if (!line.startsWith('{')) return false
  try {
    const parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>
    return typeof parsed.status === 'string'
  } catch {
    return false
  }
}

// ─── Spawn args/env resolution ───────────────────────────────────────────────

export async function resolveSpawnArgsAndEnv(
  command: WhitelistedCommand,
  args: string[],
  opts?: { tty?: boolean },
): Promise<{ args: string[]; env?: NodeJS.ProcessEnv }> {
  let spawnArgs = args
  let env: NodeJS.ProcessEnv | undefined
  const tty = opts?.tty === true

  if (command === 'videocaptioner') {
    env = await resolveSpawnEnvForVideoCaptioner()
  }

  if (command === 'yt-dlp') {
    if (!argsIncludeFfmpegLocation(args)) {
      const ffmpegPath = await discoverFfmpeg()
      if (ffmpegPath) {
        spawnArgs = ['--ffmpeg-location', ffmpegPath, ...spawnArgs]
      }
    }
    spawnArgs = injectYtdlpProgressArgs(spawnArgs)
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
      env = { ...(env ?? process.env), PYTHONUNBUFFERED: '1' }
    }
  }

  return { args: spawnArgs, env }
}

// ─── Executable resolution ───────────────────────────────────────────────────

export async function resolveCommand(command: WhitelistedCommand): Promise<ResolvedCommand> {
  let path: string | undefined
  switch (command) {
    case 'ffmpeg':
      path = await discoverFfmpeg()
      break
    case 'ffprobe':
      path = await discoverFfprobe()
      break
    case 'yt-dlp':
      path = await discoverYtdlp()
      break
    case 'videocaptioner':
      path = await discoverVideoCaptioner()
      break
    case 'qjs':
      path = await discoverQuickjs()
      break
  }
  return path
    ? { kind: 'ok', command, executablePath: path }
    : { kind: 'not-found', command }
}

// ─── yt-dlp queueing (only one at a time) ────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 300_000

let ytDlpExecuteCmdChain: Promise<void> = Promise.resolve()

/**
 * Enqueue an async task so that only one yt-dlp execution runs at a time.
 * Other commands are not affected and run in parallel.
 */
export function enqueueYtDlpExecuteCmd<T>(task: () => Promise<T>): Promise<T> {
  const next = ytDlpExecuteCmdChain.then(() => task())
  ytDlpExecuteCmdChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

/** Reset the yt-dlp queue — useful for tests. */
export function _resetYtDlpQueueForTests(): void {
  ytDlpExecuteCmdChain = Promise.resolve()
}

// ─── Streaming execution ─────────────────────────────────────────────────────

/**
 * Run a whitelisted command, streaming stdout/stderr to the provided
 * command log and emitting events to the sink. Returns once the process
 * has been spawned (events continue to flow async).
 */
export async function runCommand(opts: RunCommandOptions): Promise<RunCommandResult> {
  let {
    executablePath,
    command,
    args,
    tty: requestedTty,
    cmdLog,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    abortSignal,
    sink,
  } = opts

  // ── Test URL interception ────────────────────────────────────────────────────
  // When yt-dlp args contain a test.local URL, intercept and simulate the error
  // via bash instead of calling the real yt-dlp executable.
  const isTestMode = command === 'yt-dlp' && isTestYtDlpUrl(args);
  let usePty = false;
  let ptyFallback: PtyFallbackReason | undefined;
  let spawnArgs: string[];
  let spawnEnv: NodeJS.ProcessEnv | undefined;

  if (isTestMode) {
    // Skip PTY for test mode — use simple bash simulation
    usePty = false;

    // Extract the test URL and build the simulated error
    const testUrl = extractTestYtDlpUrl(args) ?? '';
    const errorMessage = buildYtDlpSimulatedError(testUrl);
    const bashArgs = buildTestYtDlpSimulatedSpawnArgs(errorMessage);

    // Override executable to bash and use our simulated args
    executablePath = 'bash';
    spawnArgs = bashArgs;
    spawnEnv = process.env;

    logger.info(
      { commandExecutionId: cmdLog.executionId, testUrl, errorMessage },
      '[runCommand] test URL detected, simulating yt-dlp error',
    );
    cmdLog.appendSystemNote(`test URL detected: ${testUrl}, simulating yt-dlp error`);
  } else {
    // Normal execution path
    usePty = requestedTty === true && command === 'yt-dlp' && isPtyAvailable();
    if (requestedTty && command === 'yt-dlp' && !usePty) {
      ptyFallback = isPtyAvailable()
        ? 'not-yt-dlp' // unreachable here, kept for type clarity
        : 'pty-unavailable';
      const reason = getPtyUnavailableReason();
      logger.warn(
        { commandExecutionId: cmdLog.executionId, command, reason: reason ?? 'unknown' },
        '[runCommand] PTY requested for yt-dlp but unavailable; falling back to pipe spawn',
      );
    }

    const resolved = await resolveSpawnArgsAndEnv(command, args, {
      tty: usePty,
    });
    spawnArgs = resolved.args;
    spawnEnv = resolved.env;
  }

  markCommandExecutionRunning(cmdLog.executionId, command)
  const rt0 = Date.now()
  logger.info({ commandExecutionId: cmdLog.executionId, command, usePty, spawnArgs: spawnArgs.slice(0, 3) }, '[runCommand] entering spawnAndPump')

  // Await the spawn/run loop so the returned promise resolves only when
  // the process has exited (or been killed by timeout/abort). Callers use
  // this to know when the response stream can be safely closed.
  try {
    await spawnAndPump({
      executablePath,
      command,
      spawnArgs,
      spawnEnv,
      usePty,
      cmdLog,
      timeoutMs,
      abortSignal,
      sink,
    })
    logger.info({ commandExecutionId: cmdLog.executionId, elapsedMs: Date.now() - rt0 }, '[runCommand] spawnAndPump returned')
  } catch (err) {
    logger.error(
      { commandExecutionId: cmdLog.executionId, command, elapsedMs: Date.now() - rt0, error: err },
      '[runCommand] spawn failure',
    )
  }

  return { ok: true, usePty, spawnArgs, spawnEnv, ptyFallback }
}

interface SpawnInternals {
  executablePath: string
  command: WhitelistedCommand
  spawnArgs: string[]
  spawnEnv?: NodeJS.ProcessEnv
  usePty: boolean
  cmdLog: CommandExecutionLogWriter
  timeoutMs: number
  abortSignal?: AbortSignal
  sink?: Partial<RunCommandSink>
}

function spawnAndPump(internals: SpawnInternals): Promise<void> {
  const {
    executablePath,
    command,
    spawnArgs,
    spawnEnv,
    usePty,
    cmdLog,
    timeoutMs,
    abortSignal,
    sink,
  } = internals
  return new Promise((resolve) => {
    let child: ChildProcess | IPty | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let ptyExited = false
    let cmdLogEnded = false
    // Buffer for the trailing partial line from stdout. yt-dlp may
    // emit a progress JSON line split across multiple chunks.
    let stdoutLineBuffer = ''
    let resolved = false
    const settle = (): void => {
      if (resolved) return
      resolved = true
      resolve()
    }

    const safeEndCmdLog = (note?: string): void => {
      if (cmdLogEnded) return
      cmdLogEnded = true
      if (note) cmdLog.appendSystemNote(note)
      cmdLog.close()
    }

    const handleExit = (code: number | null, signal: string | null): void => {
      flushStdoutLineBuffer()
      logger.info(
        {
          commandExecutionId: cmdLog.executionId,
          commandLogPath: cmdLog.logRelativePath,
          command,
          exitCode: code,
          signal,
        },
        '[runCommand] command finished',
      )
      const exitNote = `exit code=${code ?? 'null'} signal=${signal ?? 'null'}`
      const outcome: CommandExecutionOutcome = code === 0 ? 'success' : 'failure'
      markCommandExecutionFinished(cmdLog.executionId, {
        outcome,
        exitCode: code,
        signal: signal ?? null,
        systemNote: exitNote,
      })
      safeEndCmdLog(exitNote)
      sink?.system?.({ event: 'exit', code, signal })
      settle()
    }

    const handleError = (err: Error): void => {
      logger.error(
        { commandExecutionId: cmdLog.executionId, command, error: err.message },
        '[runCommand] command execution error',
      )
      const errorNote = `process error: ${err.message}`
      markCommandExecutionFinished(cmdLog.executionId, {
        outcome: 'failure',
        systemNote: errorNote,
      })
      safeEndCmdLog(errorNote)
      sink?.system?.({ event: 'error', message: err.message })
      settle()
    }

    const killChild = (signal?: string): void => {
      if (!child) return
      if ('kill' in child) {
        try {
          child.kill(signal as never)
        } catch {
          /* ignore */
        }
      }
    }

    const isChildRunning = (): boolean => {
      if (!child) return false
      if ('exitCode' in child) {
        // ChildProcess
        return child.exitCode === null && child.signalCode === null
      }
      // IPty
      return !ptyExited
    }

    const cleanupChild = (): void => {
      if (!child) return
      if ('stdout' in child) {
        child.removeAllListeners()
        child.stdout?.removeAllListeners()
        child.stderr?.removeAllListeners()
      }
      child = null
    }

    const flushStdoutLineBuffer = (): void => {
      if (stdoutLineBuffer.length === 0) return
      const remaining = stdoutLineBuffer
      stdoutLineBuffer = ''
      if (isYtdlpProgressJson(remaining)) {
        const parsed = parseYtdlpProgressLine(remaining)
        if (parsed) {
          // Caller is no longer listening (stream closed). The line was
          // already written to the cmdLog by the onData handler; nothing
          // else to do here for the partial buffer.
          return
        }
      }
    }

    const routeStdoutLine = (line: string): void => {
      cmdLog.appendStdout(line + '\n')
      if (isYtdlpProgressJson(line)) {
        const parsed = parseYtdlpProgressLine(line)
        if (parsed) {
          sink?.progress?.(parsed)
          return
        }
      }
      sink?.stdout?.(line)
    }

    const routeStderrChunk = (text: string): void => {
      cmdLog.appendStderr(text)
      sink?.stderr?.(text)
    }

    try {
      if (usePty) {
        const ptyMod = resolvePtyModule()
        if (!ptyMod) {
          throw new Error('node-pty is not available')
        }
        child = ptyMod.spawn(executablePath, spawnArgs, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: process.cwd(),
          env: spawnEnv ?? process.env,
          useConpty: true,
        })
        logger.info({ commandExecutionId: cmdLog.executionId, pid: (child as IPty).pid, command }, '[runCommand] pty child spawned')
        cmdLog.appendSystemNote(
          `pty spawn command=${command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)} pid=${(child as IPty).pid}`,
        )
        let firstPtyDataLogged = false
        child.onData((data: string) => {
          if (!firstPtyDataLogged) {
            firstPtyDataLogged = true
            logger.info({ commandExecutionId: cmdLog.executionId, dataLen: data.length }, '[runCommand] pty first data chunk received')
          }
          const clean = stripAnsi(data)
          stdoutLineBuffer += clean
          const lines = stdoutLineBuffer.split('\n')
          stdoutLineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            routeStdoutLine(line)
          }
        })

        child.onExit(({ exitCode, signal }) => {
          ptyExited = true
          handleExit(exitCode, signal != null ? String(signal) : null)
          cleanupChild()
        })
      } else {
        child = spawn(executablePath, spawnArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          ...(spawnEnv ? { env: spawnEnv } : {}),
        })
        logger.info({ commandExecutionId: cmdLog.executionId, pid: child.pid, command }, '[runCommand] pipe child spawned')
        cmdLog.appendSystemNote(
          `spawn command=${command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)} pid=${child.pid}`,
        )
        child.stdout?.on('data', (data: Buffer) => {
          const text = data.toString()
          stdoutLineBuffer += text
          const lines = stdoutLineBuffer.split('\n')
          stdoutLineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            routeStdoutLine(line)
          }
        })
        child.stderr?.on('data', (data: Buffer) => {
          routeStderrChunk(data.toString())
        })
        child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
          ptyExited = true
          handleExit(code, signal ?? null)
          cleanupChild()
        })
        child.on('error', (err: Error) => {
          handleError(err)
          cleanupChild()
        })
      }

      timeoutTimer = setTimeout(() => {
        if (isChildRunning()) {
          logger.warn(
            { commandExecutionId: cmdLog.executionId, command, timeoutMs },
            '[runCommand] command timed out',
          )
          const timeoutNote = `timeout after ${timeoutMs}ms`
          markCommandExecutionFinished(cmdLog.executionId, {
            outcome: 'failure',
            systemNote: timeoutNote,
          })
          safeEndCmdLog(timeoutNote)
          sink?.system?.({ event: 'timeout' })
          killChild('SIGTERM')
        }
      }, timeoutMs)

      if (abortSignal) {
        const abortHandler = (): void => {
          if (isChildRunning()) {
            logger.warn(
              { commandExecutionId: cmdLog.executionId, command },
              '[runCommand] abort signal received, terminating process',
            )
            killChild('SIGTERM')
          }
          const abortNote = 'client disconnected (abort)'
          markCommandExecutionFinished(cmdLog.executionId, {
            outcome: 'failure',
            exitCode: null,
            signal: 'SIGTERM',
            systemNote: abortNote,
          })
          safeEndCmdLog(abortNote)
          sink?.system?.({ event: 'exit', code: null, signal: 'SIGTERM' })
          settle()
          cleanupChild()
        }
        if (abortSignal.aborted) {
          abortHandler()
        } else {
          abortSignal.addEventListener('abort', abortHandler, { once: true })
        }
      }
    } catch (err) {
      logger.error(
        { commandExecutionId: cmdLog.executionId, command, error: err },
        '[runCommand] failed to spawn command',
      )
      const spawnNote = `spawn failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      markCommandExecutionFinished(cmdLog.executionId, {
        outcome: 'failure',
        systemNote: spawnNote,
      })
      safeEndCmdLog(spawnNote)
      settle()
    }
  })
}

// ─── Synchronous execution (used by videocaptioner transcriber) ───────────────

/**
 * Same executable resolution and spawn rules as the streaming path, but
 * waits for exit (no NDJSON stream). Used by routes that need a JSON
 * response instead of a stream.
 */
export async function runWhitelistedCommandSync(
  input: RunCommandSyncOptions,
): Promise<RunCommandSyncResult> {
  // ── Test URL interception ──────────────────────────────────────────────────
  // When yt-dlp args contain a test.local URL, intercept and simulate the error.
  const isTestMode = input.command === 'yt-dlp' && isTestYtDlpUrl(input.args);
  let executablePath: string;
  let spawnArgs: string[];
  let spawnEnv: NodeJS.ProcessEnv | undefined;
  let commandForLog: string;

  if (isTestMode) {
    // Use bash simulation for test URLs
    executablePath = 'bash';
    const testUrl = extractTestYtDlpUrl(input.args) ?? '';
    const errorMessage = buildYtDlpSimulatedError(testUrl);
    spawnArgs = buildTestYtDlpSimulatedSpawnArgs(errorMessage);
    spawnEnv = input.env ?? process.env;
    commandForLog = `bash ${spawnArgs.join(' ')}`;

    logger.info(
      { command: input.command, testUrl, errorMessage },
      '[runWhitelistedCommandSync] test URL detected, simulating yt-dlp error',
    );
  } else {
    // Normal execution path
    const resolved = await resolveCommand(input.command);
    if (resolved.kind === 'not-found') {
      return { error: `${input.command} executable not found` };
    }
    executablePath = resolved.executablePath;
    const resolvedArgs = await resolveSpawnArgsAndEnv(input.command, input.args);
    spawnArgs = resolvedArgs.args;
    spawnEnv = input.env ?? resolvedArgs.env;
    commandForLog = [executablePath, ...spawnArgs]
      .map((part) => (/\s/.test(part) ? `"${part}"` : part))
      .join(' ');
  }

  const run = async (): Promise<RunCommandSyncResult> => {
    const writerId =
      input.executionId !== undefined && isCommandExecutionId(input.executionId)
        ? input.executionId.trim()
        : undefined
    const cmdLog = await createCommandExecutionLogWriter(writerId)
    markCommandExecutionRunning(cmdLog.executionId, input.command)

    const withCorrelation = (result: VideoCaptionerTranscribeResult): RunCommandSyncResult => ({
      ...result,
      executionId: cmdLog.executionId,
      logRelativePath: cmdLog.logRelativePath,
    })

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
      '[runCommand] synchronous whitelisted command',
    )

    let cmdLogEnded = false
    const safeEndCmdLog = (note?: string): void => {
      if (cmdLogEnded) return
      cmdLogEnded = true
      if (note) cmdLog.appendSystemNote(note)
      cmdLog.close()
    }

    try {
      const child = spawn(executablePath, spawnArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        ...(spawnEnv ? { env: spawnEnv } : {}),
      })

      cmdLog.appendSystemNote(
        `sync spawn command=${input.command} executablePath=${executablePath} args=${JSON.stringify(spawnArgs)} commandLine=${commandForLog}`,
      )

      return await new Promise<RunCommandSyncResult>((resolve) => {
        let settled = false
        let stderrOutput = ''
        const finish = (result: VideoCaptionerTranscribeResult, logNote?: string): void => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          if (logNote) {
            const parsed = parseFinishedFromSystemNote(logNote)
            if (parsed) {
              markCommandExecutionFinished(cmdLog.executionId, {
                ...parsed,
                systemNote: logNote,
              })
            } else {
              markCommandExecutionFinished(cmdLog.executionId, {
                outcome: result.success ? 'success' : 'failure',
                exitCode: result.success ? 0 : null,
                systemNote: logNote,
              })
            }
            safeEndCmdLog(logNote)
          } else {
            markCommandExecutionFinished(cmdLog.executionId, {
              outcome: result.success ? 'success' : 'failure',
              exitCode: result.success ? 0 : null,
            })
            safeEndCmdLog()
          }
          resolve(withCorrelation(result))
        }

        const timeoutId = setTimeout(() => {
          try {
            child.kill()
          } catch {
            // ignore
          }
          finish(
            { error: `${input.command} timed out after ${input.timeoutMs}ms` },
            `timeout after ${input.timeoutMs}ms`,
          )
        }, input.timeoutMs)

        child.once('error', (error) => {
          finish(
            {
              error: `failed to run ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
            },
            `process error: ${error instanceof Error ? error.message : 'unknown error'}`,
          )
        })

        child.once('close', (code) => {
          if (code === 0) {
            finish({ success: true }, `exit code=${code}`)
            return
          }
          const trimmedStderr = stderrOutput.trim()
          const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : ''
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
            '[runCommand] synchronous command exited with non-zero code',
          )
          finish(
            { error: `${input.command} exited with code ${code ?? 'unknown'}${stderrSuffix}` },
            `exit code=${code ?? 'null'} stderr preview in application log`,
          )
        })

        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStdout(chunk)
        })

        child.stderr?.setEncoding('utf8')
        child.stderr?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStderr(chunk)
          stderrOutput += String(chunk)
        })
      })
    } catch (error) {
      const spawnNote = `spawn failed: ${error instanceof Error ? error.message : 'unknown error'}`
      markCommandExecutionFinished(cmdLog.executionId, {
        outcome: 'failure',
        systemNote: spawnNote,
      })
      safeEndCmdLog(spawnNote)
      logger.error(
        {
          error,
          command: input.command,
          commandExecutionId: cmdLog.executionId,
          ...input.logMeta,
        },
        '[runCommand] failed to spawn synchronous command',
      )
      return withCorrelation({
        error: `failed to start ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
      })
    }
  }

  if (input.command === 'yt-dlp') {
    return enqueueYtDlpExecuteCmd(run)
  }
  return run()
}
