/**
 * Verify GitHub check runs for a commit (used before release).
 *
 * Usage:
 *   bun ci/verify-check-runs.ts [--sha <commit>] [--preset release]
 *   bun ci/verify-check-runs.ts [--sha <commit>] --check "Run Unit Tests" --check "Lint UI"
 *
 * Environment: GITHUB_TOKEN, GITHUB_REPOSITORY
 */
import {
  RELEASE_REQUIRED_CHECKS,
  verifyRequiredCheckRuns,
  type CheckRun,
} from './verify-check-runs-lib';

type ParsedArgs =
  | { sha: string | undefined; checks: string[] }
  | 'usage';

function printUsage(): void {
  console.error(
    'Usage: bun ci/verify-check-runs.ts [--sha <commit>] [--preset release] [--check <name> ...]',
  );
}

function parseArgs(argv: string[]): ParsedArgs {
  let sha: string | undefined;
  const checks: string[] = [];
  let presetRelease = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--sha') {
      const next = argv[++i];
      if (!next) return 'usage';
      sha = next;
      continue;
    }
    if (a === '--preset') {
      const next = argv[++i];
      if (next !== 'release') return 'usage';
      presetRelease = true;
      continue;
    }
    if (a === '--check') {
      const next = argv[++i];
      if (!next) return 'usage';
      checks.push(next);
      continue;
    }
    if (a === '--help' || a === '-h') return 'usage';
    return 'usage';
  }

  const resolvedChecks = presetRelease
    ? [...RELEASE_REQUIRED_CHECKS]
    : checks;

  if (resolvedChecks.length === 0) return 'usage';

  return { sha, checks: resolvedChecks };
}

async function fetchAllCheckRuns(
  repo: string,
  sha: string,
  token: string,
): Promise<CheckRun[]> {
  const runs: CheckRun[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      total_count: number;
      check_runs: CheckRun[];
    };
    runs.push(...data.check_runs);
    if (runs.length >= data.total_count) break;
    page += 1;
  }

  return runs;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'usage') {
    printUsage();
    return 2;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const sha = parsed.sha ?? process.env.GITHUB_SHA;

  if (!repo || !token) {
    console.error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
    return 2;
  }
  if (!sha) {
    console.error('Commit SHA required (--sha or GITHUB_SHA).');
    return 2;
  }

  const runs = await fetchAllCheckRuns(repo, sha, token);
  const result = verifyRequiredCheckRuns(runs, sha, parsed.checks);

  if (result.ok) {
    console.log(
      `All required checks passed for ${sha}: ${parsed.checks.join(', ')}`,
    );
    return 0;
  }

  if (result.missing.length > 0) {
    console.error(
      `Missing successful check runs on ${sha}:\n${result.missing.map((n) => `  - ${n}`).join('\n')}`,
    );
  }
  if (result.failed.length > 0) {
    console.error(
      `Checks did not succeed on ${sha}:\n${result.failed.map((n) => `  - ${n}`).join('\n')}`,
    );
  }
  console.error(
    'Run CI on this commit (push/PR or manual E2E workflows) and wait for all jobs to pass.',
  );
  return 1;
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
  });
