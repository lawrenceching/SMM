import { spawn, type ChildProcess } from 'node:child_process';

export interface ManagedChild {
  proc: ChildProcess;
  pid: number | undefined;
}

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onStdout: (chunk: Buffer) => void;
  onStderr: (chunk: Buffer) => void;
}

export function spawnChild(opts: SpawnOptions): ManagedChild {
  const proc = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: opts.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });

  proc.stdout?.on('data', opts.onStdout);
  proc.stderr?.on('data', opts.onStderr);

  return { proc, pid: proc.pid };
}

function killProcessTree(child: ManagedChild, signal: NodeJS.Signals): void {
  if (!child.pid || child.proc.killed) return;

  if (process.platform === 'win32') {
    const force = signal === 'SIGKILL';
    spawn(
      'taskkill',
      force
        ? ['/pid', String(child.pid), '/f', '/t']
        : ['/pid', String(child.pid), '/t'],
      { shell: true, stdio: 'ignore' },
    );
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      process.kill(child.pid, signal);
    } catch {
      // Process may already be gone.
    }
  }
}

function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<void> {
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

export async function killTreeAndWait(
  child: ManagedChild,
  graceMs: number,
): Promise<void> {
  killProcessTree(child, 'SIGTERM');
  await waitForExit(child.proc, graceMs);

  if (child.pid && child.proc.exitCode === null && child.proc.signalCode === null) {
    killProcessTree(child, 'SIGKILL');
    await waitForExit(child.proc, 1000);
  }
}
