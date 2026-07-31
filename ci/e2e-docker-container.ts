/**
 * Cicd background for docker e2e: run Compose (`smm` + `http-proxy`) in the
 * foreground so stdout/stderr stream into the cicd timeline (`container.log`
 * after slicing). Teardown runs `compose down`; we also stop on signals /
 * exit for Windows taskkill races.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCKER_CONTAINER_NAME = 'smm';
export const DOCKER_IMAGE = 'smm:latest';
export const DOCKER_COMPOSE_PROJECT = 'smm-e2e';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TUTORIALS_SRC = path.join(REPO_ROOT, 'apps/e2e/test/media/tutorials');
export const DOCKER_COMPOSE_FILE = path.join(
  REPO_ROOT,
  'apps/e2e/docker/docker-compose.yml',
);

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

/** Args for `docker compose … up` (no detached mode — foreground for cicd). */
export function buildDockerComposeUpArgs(options: {
  authToken: string;
  mediaHostDir: string;
}): string[] {
  return [
    'compose',
    '-f',
    DOCKER_COMPOSE_FILE,
    '-p',
    DOCKER_COMPOSE_PROJECT,
    'up',
    '--build',
    '--abort-on-container-exit',
    '--exit-code-from',
    'smm',
  ];
}

/** Env for compose: media bind path + auth token (+ optional discover URL for container). */
export function rewriteLoopbackUrlForDockerContainer(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      url.hostname = 'host.docker.internal';
      return url.toString();
    }
  } catch {
    // Keep the raw value when it is not a valid URL.
  }
  return raw;
}

/** Env for compose: media bind path + auth token. */
export function buildDockerComposeEnv(options: {
  authToken: string;
  mediaHostDir: string;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SMM_AUTH_TOKEN: options.authToken,
    SMM_E2E_MEDIA_HOST_DIR: options.mediaHostDir,
  };
  const externalConfig = process.env.EXTERNAL_CONFIG_FILE_URL?.trim();
  if (externalConfig) {
    env.EXTERNAL_CONFIG_FILE_URL = rewriteLoopbackUrlForDockerContainer(externalConfig);
  }
  return env;
}

/** @deprecated Prefer buildDockerComposeUpArgs — kept for callers that still expect run-shape docs. */
export function buildDockerRunArgs(options: {
  authToken: string;
  mediaHostDir: string;
}): string[] {
  return buildDockerComposeUpArgs(options);
}

function runDocker(args: string[], stdio: 'inherit' | 'ignore' = 'inherit'): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio, shell: false });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function composeDownArgs(): string[] {
  return ['compose', '-f', DOCKER_COMPOSE_FILE, '-p', DOCKER_COMPOSE_PROJECT, 'down', '--remove-orphans'];
}

/** Stop the e2e compose stack; safe to call when none is running. */
export async function stopDockerE2eContainer(): Promise<void> {
  try {
    await runDocker(composeDownArgs(), 'ignore');
  } catch {
    // Stack may not exist yet / docker unavailable during shutdown races.
  }
  // Best-effort: named container from older docker-run lifecycle.
  try {
    await runDocker(['stop', DOCKER_CONTAINER_NAME], 'ignore');
  } catch {
    // ignore
  }
}

/** Sync stop for process exit hooks (Windows taskkill may skip async shutdown). */
export function stopDockerE2eContainerSync(): void {
  try {
    spawnSync('docker', composeDownArgs(), {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
  } catch {
    // Best-effort last resort.
  }
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
  console.log(`[e2e-docker-container] compose file: ${DOCKER_COMPOSE_FILE}`);
  registerProcessExitCleanup();
  await stopDockerE2eContainer();

  const args = buildDockerComposeUpArgs({ authToken, mediaHostDir });
  const env = buildDockerComposeEnv({ authToken, mediaHostDir });
  console.log(`[e2e-docker-container] docker ${args.join(' ')}`);

  const run = spawn('docker', args, { stdio: 'inherit', shell: false, env });

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
