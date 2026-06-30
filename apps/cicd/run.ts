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

process.on('unhandledRejection', (reason) => {
  console.error(reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

try {
  const result = await run({
    configPath: path.resolve(cwd, values.config),
    cwd,
  });
  new ConsoleReporter({ cwd }).print(result);
  process.exit(result.exitCode);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
