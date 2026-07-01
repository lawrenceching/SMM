/**
 * E2E test runner: builds an apps/cicd JSON config and runs WebdriverIO via @smm/cicd.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *
 * Config is written to `artifacts/e2e/config.json`.
 * Logs are written by apps/cicd to `artifacts/cicd/{commandId}/`:
 *   - {spec}/main.log  — WebdriverIO output per spec file
 *   - {spec}/cli.log   — pnpm e2e:cli output during that spec's window
 *   - {spec}/ui.log    — pnpm dev:ui output during that spec's window
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildE2eConfig } from './build-e2e-config.ts';
import {
  startChild,
  awaitChildExit,
  killTree,
  type ManagedRunChild,
} from './run-e2e-child.ts';

let currentChild: ManagedRunChild | null = null;
let shuttingDown = false;
let signalCount = 0;

const handleSignal = async (sig: NodeJS.Signals): Promise<void> => {
  signalCount += 1;
  if (signalCount === 1 && currentChild) {
    shuttingDown = true;
    console.error(`\n[run-e2e-test] received ${sig}, forwarding to child...`);
    if (currentChild.pid) {
      try {
        if (process.platform !== 'win32') {
          process.kill(-currentChild.pid, 'SIGTERM');
        }
      } catch {
        // best-effort
      }
    }
    return;
  }
  console.error(`[run-e2e-test] received ${sig} twice, force-killing tree`);
  if (currentChild) {
    await killTree(currentChild, 1000);
  }
  process.exit(130);
};

process.on('SIGINT', () => void handleSignal('SIGINT'));
process.on('SIGTERM', () => void handleSignal('SIGTERM'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WDIO_ARGS = process.argv.slice(2);

const CONFIG_REL_PATH = 'artifacts/e2e/config.json';
const CONFIG_PATH = path.join(ROOT, CONFIG_REL_PATH);
const CICD_OUTPUT_DIR = path.join(ROOT, 'artifacts', 'cicd');

function log(message: string): void {
  console.log(`[run-e2e-test] ${message}`);
}

function toRepoRelativePath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).split(path.sep).join('/');
}

function exportCiOutputs(logDir: string, success: boolean): void {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) return;

  const lines = [
    `log_dir=${toRepoRelativePath(logDir)}`,
    `success=${success}`,
  ];
  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`);
}

function parseOutputDir(stdout: string): string | null {
  const match = stdout.match(/^output: (.+)$/m);
  return match ? match[1]!.trim() : null;
}

function findLatestCicdOutputDir(): string | null {
  if (!fs.existsSync(CICD_OUTPUT_DIR)) return null;

  const entries = fs
    .readdirSync(CICD_OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      mtime: fs.statSync(path.join(CICD_OUTPUT_DIR, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (entries.length === 0) return null;
  return path.join(CICD_OUTPUT_DIR, entries[0]!.name);
}

async function runCicd(configPath: string): Promise<{ exitCode: number; stdout: string }> {
  let stdout = '';

  currentChild = startChild({
    command: 'bun',
    args: ['apps/cicd/run.ts', '-f', configPath, '--cwd', ROOT],
    cwd: ROOT,
    env: process.env,
    onStdout: (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    },
    onStderr: (chunk) => process.stderr.write(chunk),
  });

  const exit = await awaitChildExit(currentChild);

  if (shuttingDown) {
    await killTree(currentChild, 2000);
  }
  currentChild = null;
  return { exitCode: exit.exitCode, stdout };
}

function printRunSummary(options: {
  success: boolean;
  outputDir: string;
  specTaskNames: string[];
}): void {
  console.log(`success: ${options.success}`);
  console.log(`output dir: ${toRepoRelativePath(options.outputDir)}`);
  for (const taskName of options.specTaskNames) {
    const mainLog = path.join(options.outputDir, taskName, 'main.log');
    console.log(`log: ${toRepoRelativePath(mainLog)}`);
  }
}

async function main(): Promise<number> {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });

  const config = buildE2eConfig(WDIO_ARGS, ROOT);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  log(`wrote config: ${CONFIG_REL_PATH}`);
  log(`wdio args: ${WDIO_ARGS.length > 0 ? WDIO_ARGS.join(' ') : '(default: all specs)'}`);

  const specTaskCount = config.tasks.filter((task) => task.name !== 'wait-ready').length;
  log(`spec tasks: ${specTaskCount}`);

  const { exitCode, stdout } = await runCicd(CONFIG_REL_PATH);

  let outputDir = parseOutputDir(stdout);
  if (!outputDir) {
    outputDir = findLatestCicdOutputDir();
    if (outputDir) {
      log(`fallback output dir: ${toRepoRelativePath(outputDir)}`);
    }
  }

  const success = exitCode === 0;
  const specTaskNames = config.tasks
    .filter((task) => task.name !== 'wait-ready')
    .map((task) => task.name);

  if (outputDir) {
    exportCiOutputs(outputDir, success);
    printRunSummary({ success, outputDir, specTaskNames });
    const debugLog = path.join(outputDir, '_debug', 'events.jsonl');
    if (fs.existsSync(debugLog)) {
      log(`debug log: ${toRepoRelativePath(debugLog)}`);
    }
  } else {
    console.log(`success: ${success}`);
    log('could not determine output directory');
  }

  return exitCode;
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('[run-e2e-test] failed:', error);
    process.exit(1);
  });
