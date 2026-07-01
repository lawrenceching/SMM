import { spawn, type ChildProcess } from 'node:child_process';

export type ManagedRunChild = {
  proc: ChildProcess | null;
  pid: number | undefined;
  start(): void;
};

export type StartChildOptions = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onStdout: (chunk: Buffer) => void;
  onStderr: (chunk: Buffer) => void;
};

export function startChild(opts: StartChildOptions): ManagedRunChild {
  const managed: ManagedRunChild = {
    proc: null,
    pid: undefined,
    start() {
      const proc = spawn(opts.command, opts.args, {
        cwd: opts.cwd,
        env: opts.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: true,
      });
      managed.proc = proc;
      managed.pid = proc.pid;
      proc.stdout?.on('data', opts.onStdout);
      proc.stderr?.on('data', opts.onStderr);
    },
  };
  managed.start();
  return managed;
}

export type ChildExitResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
};

export function awaitChildExit(child: ManagedRunChild): Promise<ChildExitResult> {
  return new Promise((resolve) => {
    if (!child.proc) {
      resolve({ exitCode: 1, signal: null });
      return;
    }
    child.proc.once('close', (code, signal) => {
      resolve({ exitCode: code ?? 1, signal });
    });
    child.proc.once('error', () => {
      resolve({ exitCode: 1, signal: null });
    });
  });
}

export async function killTree(child: ManagedRunChild, graceMs: number): Promise<void> {
  if (!child.proc || !child.pid || child.proc.killed) return;
  if (process.platform === 'win32') {
    spawn(
      'taskkill',
      ['/pid', String(child.pid), '/t', '/f'],
      { shell: false, stdio: 'ignore', windowsHide: true },
    );
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        return;
      }
    }
  }
  // Wait for close.
  const start = Date.now();
  while (child.proc.exitCode === null && child.proc.signalCode === null) {
    if (Date.now() - start > graceMs) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (child.proc.exitCode === null && child.proc.signalCode === null) {
    // Force-kill.
    if (process.platform === 'win32') {
      spawn(
        'taskkill',
        ['/pid', String(child.pid), '/t', '/f'],
        { shell: false, stdio: 'ignore', windowsHide: true },
      );
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already dead
      }
    }
  }
}