import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { ConsoleReporter } from './src/console-reporter.ts';
import { run } from './src/index.ts';

const HELP = `Usage: bun apps/cicd/run.ts -f <config.json> [--cwd <dir>]`;

const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'f' },
    cwd: { type: 'string', default: process.cwd() },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

if (!values.config) {
  console.error('Error: --config/-f is required');
  console.error(HELP);
  process.exit(2);
}

const cwd = values.cwd!;

const controller = new AbortController();
let signalCount = 0;
const handleSignal = (sig: NodeJS.Signals) => {
  signalCount += 1;
  if (signalCount === 1) {
    console.error(`\n[cicd] received ${sig}, cleaning up...`);
    controller.abort();
    return;
  }
  // Second signal: hard exit.
  console.error(`[cicd] received ${sig} twice, force-exiting`);
  process.exit(130);
};
process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

process.on('unhandledRejection', (reason) => {
  console.error(reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

try {
  const result = await run({
    configPath: path.resolve(cwd, values.config),
    cwd,
    signal: controller.signal,
  });
  new ConsoleReporter({ cwd }).print(result);
  process.exit(result.exitCode);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
