/**
 * Cicd background for docker e2e: start `smm` container and stream `docker logs -f`.
 * Teardown on SIGTERM/SIGINT stops the container (`--rm` removes it).
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DOCKER_CONTAINER_NAME = 'smm';
export const DOCKER_IMAGE = 'smm:latest';

export function resolveDockerMediaHostDir(): string {
  return path.join(os.tmpdir(), 'smm');
}

export function buildDockerRunArgs(options: {
  authToken: string;
  mediaHostDir: string;
}): string[] {
  return [
    'run',
    '-d',
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

function runDocker(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function stopContainerQuietly(): Promise<void> {
  try {
    await runDocker(['stop', DOCKER_CONTAINER_NAME]);
  } catch {
    // Container may not exist yet / docker unavailable during shutdown races.
  }
}

async function main(): Promise<void> {
  const authToken = process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123';
  const mediaHostDir = resolveDockerMediaHostDir();
  fs.mkdirSync(mediaHostDir, { recursive: true });

  console.log(`[e2e-docker-container] media host dir: ${mediaHostDir}`);
  await stopContainerQuietly();

  const runCode = await runDocker(buildDockerRunArgs({ authToken, mediaHostDir }));
  if (runCode !== 0) {
    throw new Error(`docker run failed with exit ${runCode}`);
  }

  const follow = spawn('docker', ['logs', '-f', DOCKER_CONTAINER_NAME], {
    stdio: 'inherit',
    shell: false,
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      follow.kill('SIGTERM');
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

  const followCode = await new Promise<number>((resolve, reject) => {
    follow.on('error', reject);
    follow.on('close', (code) => resolve(code ?? 0));
  });

  await shutdown();
  if (followCode !== 0 && !stopping) {
    process.exit(followCode);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[e2e-docker-container] failed:', error);
    process.exit(1);
  });
}
