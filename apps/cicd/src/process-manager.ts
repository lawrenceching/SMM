import { spawn, type ChildProcess } from 'node:child_process';

export interface ManagedChild {
  proc: ChildProcess | null;
  pid: number | undefined;
  spawnFailed: boolean;
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
  const managed: ManagedChild = {
    proc: null,
    pid: undefined,
    spawnFailed: false,
  };

  try {
    const proc = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    managed.proc = proc;
    managed.pid = proc.pid;

    proc.stdout?.on('data', opts.onStdout);
    proc.stderr?.on('data', opts.onStderr);
    proc.once('error', (error) => {
      managed.spawnFailed = true;
      opts.onStderr(
        Buffer.from(
          `${error instanceof Error ? error.message : String(error)}\n`,
        ),
      );
    });
  } catch (error) {
    managed.spawnFailed = true;
    opts.onStderr(
      Buffer.from(
        `${error instanceof Error ? error.message : String(error)}\n`,
      ),
    );
  }

  return managed;
}

export async function waitForSpawn(child: ManagedChild): Promise<boolean> {
  if (child.spawnFailed || !child.proc) {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok && !child.spawnFailed);
    };

    const timer = setTimeout(() => finish(child.pid !== undefined), 100);

    child.proc!.once('spawn', () => finish(true));
    child.proc!.once('error', () => finish(false));
  });
}

export function waitForChildExit(child: ManagedChild): Promise<number> {
  if (child.spawnFailed || !child.proc) {
    return Promise.resolve(1);
  }

  return new Promise((resolve) => {
    const { proc } = child;

    if (proc!.exitCode !== null) {
      resolve(proc!.exitCode);
      return;
    }

    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };

    proc!.once('error', () => finish(1));
    proc!.once('close', (code) => finish(code ?? 1));
  });
}

function killProcessTree(child: ManagedChild, signal: NodeJS.Signals): void {
  if (child.spawnFailed || !child.proc || !child.pid || child.proc.killed) return;

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
  if (child.spawnFailed || !child.proc || !child.pid) {
    return;
  }

  killProcessTree(child, 'SIGTERM');
  await waitForExit(child.proc, graceMs);

  if (child.pid && child.proc.exitCode === null && child.proc.signalCode === null) {
    killProcessTree(child, 'SIGKILL');
    await waitForExit(child.proc, 1000);
  }
}
