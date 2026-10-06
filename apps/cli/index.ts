import 'dotenv/config';
import {
  applyTmdbTlsDevBypassToProcessIfEnabled,
  trustAllTmdbCertEnabled,
} from '@/utils/tmdbTls';
import { logger } from '@smm/server';

applyTmdbTlsDevBypassToProcessIfEnabled();

if (trustAllTmdbCertEnabled()) {
  logger.warn(
    'TRUST_ALL_TMDB_CERT is set: TLS verification is disabled for this process (dev only; NODE_TLS_REJECT_UNAUTHORIZED=0)'
  );
}

// All subcommands (incl. `web`) are handled by Commander via runCli.
const cliCommands = new Set(['list', 'add', 'addlib', 'show', 'metadata', 'rm', 'config', 'recognize', 'try-to-recognize', 'try-to-rename', 'apply', 'reject', 'plan', 'scrape', 'job', 'rename', 'rename-episode-file', 'hello', 'tmdb', 'tvdb', 'mcp', 'web'])
const firstArg = process.argv[2]
const isCliHelp = firstArg === '--help' || firstArg === '-h'
if (firstArg !== undefined && (cliCommands.has(firstArg) || isCliHelp)) {
  const { runCli } = await import('./src/cli/runCli');
  const code = await runCli(process.argv);
  process.exit(code);
}

// No subcommand: print help instead of starting the server.
if (firstArg === undefined) {
  const { runCli } = await import('./src/cli/runCli');
  await runCli(['node', 'smm', '--help']);
  process.exit(0);
}

console.error(`Unknown command: ${firstArg}`);
console.error('Run "smm --help" to list available commands.');
process.exit(1);
