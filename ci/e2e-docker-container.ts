/**
 * Cicd background for docker e2e: run `smm` container in the foreground so
 * stdout/stderr stream into the cicd timeline (`container.log` after slicing).
 * Teardown kills this process tree; `--rm` removes the container. We also
 * `docker stop` on signals / exit for Windows taskkill races.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCKER_CONTAINER_NAME = 'smm';
export const DOCKER_IMAGE = 'smm:latest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TUTORIALS_SRC = path.join(REPO_ROOT, 'apps/e2e/test/media/tutorials');

export function resolveDockerMediaHostDir(): string {
  return path.join(os.tmpdir(), 'smm');
}

/** Sync local tutorial mp4 fixtures into the bind-mounted /media volume. */
export function syncTutorialFixturesToMediaHostDir(mediaHostDir: string): void {
  if (!fs.existsSync(TUTORIALS_SRC)) {
    console.warn(
      `[e2e-docker-container] tutorials not found at ${TUTORIALS_SRC}; Transcribe manual specs will fail`,
    );
    return;
  }
  const dest = path.join(mediaHostDir, 'tutorials');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(TUTORIALS_SRC, dest, { recursive: true });
  console.log(`[e2e-docker-container] synced tutorials -> ${dest}`);
}

/** Foreground `docker run` (no `-d`) so killing this process stops the container. */
export function buildDockerRunArgs(options: {
  authToken: string;
  mediaHostDir: string;
}): string[] {
  return [
    'run',
    '--rm',
    '--name',
    DOCKER_CONTAINER_NAME,
    '-p',
    '30000:30000',
    '-p',
    '30001:30001',
    '-p',
    '30002:30002',
    '-e',
    `SMM_AUTH_TOKEN=${options.authToken}`,
    '-e',
    'WEBUI_ADDRESS=0.0.0.0',
    '-e',
    'REVERSE_PROXY_ADDRESS=0.0.0.0',
    '-e',
    'MCP_ADDRESS=0.0.0.0',
    '-v',
    `${options.mediaHostDir}:/media`,
    DOCKER_IMAGE,
  ];
}

function runDocker(args: string[], stdio: 'inherit' | 'ignore' = 'inherit'): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio, shell: false });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Stop the named e2e container; safe to call when none is running. */
export async function stopDockerE2eContainer(): Promise<void> {
  try {
    await runDocker(['stop', DOCKER_CONTAINER_NAME], 'ignore');
  } catch {
    // Container may not exist yet / docker unavailable during shutdown races.
  }
}

/** Sync stop for process exit hooks (Windows taskkill may skip async shutdown). */
export function stopDockerE2eContainerSync(): void {
  try {
    spawnSync('docker', ['stop', DOCKER_CONTAINER_NAME], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
  } catch {
    // Best-effort last resort.
  }
}

function registerProcessExitCleanup(): void {
  process.on('exit', stopDockerE2eContainerSync);
}

function waitForClose(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

async function main(): Promise<void> {
  const authToken = process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123';
  const mediaHostDir = resolveDockerMediaHostDir();
  fs.mkdirSync(mediaHostDir, { recursive: true });
  syncTutorialFixturesToMediaHostDir(mediaHostDir);

  console.log(`[e2e-docker-container] media host dir: ${mediaHostDir}`);
  registerProcessExitCleanup();
  await stopDockerE2eContainer();

  const args = buildDockerRunArgs({ authToken, mediaHostDir });
  console.log(`[e2e-docker-container] docker ${args.join(' ')}`);

  const run = spawn('docker', args, { stdio: 'inherit', shell: false });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      run.kill('SIGTERM');
    } catch {
      // already exited
    }
    await stopDockerE2eContainer();
  };

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGHUP', () => {
    void shutdown().finally(() => process.exit(0));
  });

  const runCode = await waitForClose(run);
  await shutdown();
  if (runCode !== 0 && !stopping) {
    process.exit(runCode);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[e2e-docker-container] failed:', error);
    process.exit(1);
  });
}
