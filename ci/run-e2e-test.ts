/**
 * E2E test runner: starts dev servers, runs WebdriverIO, and collects logs.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *
 * Logs are written to `.log/{commandId}/`:
 *   - cli.log     — pnpm dev:cli output
 *   - test.log    — wdio output
 *   - browser.log — browser console/page logs from test.log (see wdio.conf.ts)
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WDIO_ARGS = process.argv.slice(2);

const CLI_READY_URL = 'http://localhost:30000/api/hello';
const UI_READY_URL = 'http://localhost:5173';
const CLI_AUTH_TOKEN = 'ChangeMe123';
const CLEANUP_GRACE_MS = 5_000;

const backgroundProcesses: ChildProcess[] = [];
const backgroundLogStreams: fs.WriteStream[] = [];

function log(message: string): void {
  console.log(`[run-e2e-test] ${message}`);
}

function killUnixProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Process may already be gone.
    }
  }
}

function killProcessTree(proc: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (!proc.pid || proc.killed) return;

  if (process.platform === 'win32') {
    const force = signal === 'SIGKILL';
    spawn(
      'taskkill',
      force ? ['/pid', String(proc.pid), '/f', '/t'] : ['/pid', String(proc.pid), '/t'],
      { shell: true, stdio: 'ignore' },
    );
    return;
  }

  killUnixProcessGroup(proc.pid, signal);
}

function closeBackgroundLogStreams(): void {
  for (const stream of backgroundLogStreams) {
    stream.destroy();
  }
  backgroundLogStreams.length = 0;
}

function waitForProcessExit(proc: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, timeoutMs);
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function cleanupBackgroundProcesses(): Promise<void> {
  for (const proc of backgroundProcesses) {
    killProcessTree(proc, 'SIGTERM');
  }

  closeBackgroundLogStreams();

  await Promise.all(
    backgroundProcesses.map((proc) => waitForProcessExit(proc, CLEANUP_GRACE_MS)),
  );

  for (const proc of backgroundProcesses) {
    if (proc.pid && proc.exitCode === null) {
      killProcessTree(proc, 'SIGKILL');
    }
  }

  await Promise.all(
    backgroundProcesses.map((proc) => waitForProcessExit(proc, 1_000)),
  );
}

function spawnBackground(
  command: string,
  args: string[],
  options: { cwd: string; logPath?: string; env?: NodeJS.ProcessEnv },
): ChildProcess {
  const logStream = options.logPath
    ? fs.createWriteStream(options.logPath, { flags: 'w' })
    : null;

  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: process.platform === 'win32',
    stdio: logStream ? ['ignore', 'pipe', 'pipe'] : 'ignore',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  backgroundProcesses.push(proc);

  if (logStream) {
    backgroundLogStreams.push(logStream);

    const writeChunk = (chunk: Buffer) => {
      logStream.write(chunk);
    };

    proc.stdout?.on('data', writeChunk);
    proc.stderr?.on('data', writeChunk);

    proc.on('close', () => {
      logStream.end();
    });
  }

  return proc;
}

async function runWdio(
  args: string[],
  options: { cwd: string; logPath: string; env?: NodeJS.ProcessEnv },
): Promise<number> {
  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(options.logPath, { flags: 'w' });

    const proc = spawn('pnpm', ['wdio', ...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const writeChunk = (chunk: Buffer) => {
      logStream.write(chunk);
    };

    proc.stdout?.on('data', writeChunk);
    proc.stderr?.on('data', writeChunk);

    const finish = (code: number) => {
      logStream.end();
      resolve(code);
    };

    proc.on('close', (code) => {
      finish(code ?? 1);
    });
    proc.on('error', () => {
      finish(1);
    });
  });
}

async function waitForHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const {
    method = 'GET',
    headers,
    timeoutMs = 120_000,
    intervalMs = 500,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/** Matches browser log lines emitted in wdio.conf.ts before hook. */
const BROWSER_LOG_LINE =
  /\[BROWSER (?:CONSOLE(?: (?:ERROR|WARN|INFO))?|PAGE ERROR)\]/;

function extractBrowserLogs(testLogPath: string, browserLogPath: string): void {
  const content = fs.readFileSync(testLogPath, 'utf8');
  const browserLogs = content
    .split(/\r?\n/)
    .filter((line) => BROWSER_LOG_LINE.test(line))
    .join('\n');

  fs.writeFileSync(browserLogPath, browserLogs.length > 0 ? `${browserLogs}\n` : '');
}

function toRepoRelativePath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).split(path.sep).join('/');
}

function printRunSummary(options: {
  success: boolean;
  commandId: string;
  browserLogPath: string;
  cliLogPath: string;
  testLogPath: string;
}): void {
  console.log(`success: ${options.success}`);
  console.log(`command id: ${options.commandId}`);
  console.log(`browser log: ${toRepoRelativePath(options.browserLogPath)}`);
  console.log(`cli log: ${toRepoRelativePath(options.cliLogPath)}`);
  console.log(`test command log: ${toRepoRelativePath(options.testLogPath)}`);
}

async function main(): Promise<number | null> {
  const commandId = String(Math.floor(Date.now() / 1000));
  const logDir = path.join(ROOT, '.log', commandId);
  fs.mkdirSync(logDir, { recursive: true });

  const cliLogPath = path.join(logDir, 'cli.log');
  const testLogPath = path.join(logDir, 'test.log');
  const browserLogPath = path.join(logDir, 'browser.log');

  log(`command id: ${commandId}`);
  log(`log directory: ${logDir}`);

  let exitCode: number | null = null;

  process.on('SIGINT', () => {
    void cleanupBackgroundProcesses().finally(() => {
      process.exit(130);
    });
  });
  process.on('SIGTERM', () => {
    void cleanupBackgroundProcesses().finally(() => {
      process.exit(143);
    });
  });

  try {
    log('starting pnpm dev:cli');
    spawnBackground('pnpm', ['dev:cli'], { cwd: ROOT, logPath: cliLogPath });

    log('waiting for CLI (http://localhost:30000)');
    await waitForHttp(CLI_READY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLI_AUTH_TOKEN}` },
    });

    log('starting pnpm dev:ui');
    spawnBackground('pnpm', ['dev:ui'], { cwd: ROOT });

    log('waiting for UI (http://localhost:5173)');
    await waitForHttp(UI_READY_URL);

    log(`running wdio with args: ${WDIO_ARGS.length > 0 ? WDIO_ARGS.join(' ') : '(none)'}`);
    exitCode = await runWdio(WDIO_ARGS, {
      cwd: path.join(ROOT, 'apps/e2e'),
      logPath: testLogPath,
      env: { ...process.env, BROWSER_LOG_ENABLED: 'true' },
    });

    extractBrowserLogs(testLogPath, browserLogPath);
    return exitCode;
  } finally {
    await cleanupBackgroundProcesses();
    printRunSummary({
      success: exitCode === 0,
      commandId,
      browserLogPath,
      cliLogPath,
      testLogPath,
    });
  }
}

main()
  .then((exitCode) => {
    process.exit(exitCode ?? 1);
  })
  .catch((error) => {
    console.error('[run-e2e-test] failed:', error);
    void cleanupBackgroundProcesses().finally(() => {
      process.exit(1);
    });
  });
