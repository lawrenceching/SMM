/**
 * Cicd background for docker e2e: run `smm` container in the foreground so
 * stdout/stderr stream into the cicd timeline (`container.log` after slicing).
 * Teardown kills this process tree; `--rm` removes the container. We also
 * `docker stop` on signals / exit for Windows taskkill races.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DOCKER_CONTAINER_NAME = 'smm';
export const DOCKER_IMAGE = 'smm:latest';

export function resolveDockerMediaHostDir(): string {
  return path.join(os.tmpdir(), 'smm');
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
    '30002:30002',
    '-e',
    `SMM_AUTH_TOKEN=${options.authToken}`,
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

async function stopContainerQuietly(): Promise<void> {
  try {
    await runDocker(['stop', DOCKER_CONTAINER_NAME], 'ignore');
  } catch {
    // Container may not exist yet / docker unavailable during shutdown races.
  }
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

  console.log(`[e2e-docker-container] media host dir: ${mediaHostDir}`);
  await stopContainerQuietly();

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
    await stopContainerQuietly();
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
