/**
 * Verify that a commit has a successful docker-e2e / gate check run.
 *
 * Usage (repo root):
 *   bun ci/verify-docker-e2e-gate.ts [--sha <commit-sha>]
 *
 * Environment:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo)
 *
 * Exit: 0 = gate passed; 1 = no successful gate; 2 = usage/error
 */

const GATE_CHECK_NAME = 'docker-e2e / gate';

type CheckRun = {
  name: string;
  conclusion: string | null;
  head_sha: string;
  status: string;
};

function printUsage(): void {
  console.error('Usage: bun ci/verify-docker-e2e-gate.ts [--sha <commit-sha>]');
}

function parseArgs(argv: string[]): { sha: string | undefined } | 'usage' {
  let sha: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--sha') {
      const next = argv[++i];
      if (!next) return 'usage';
      sha = next;
      continue;
    }
    if (a === '--help' || a === '-h') return 'usage';
    return 'usage';
  }
  return { sha };
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
  const gateRuns = runs.filter(
    (r) => r.name === GATE_CHECK_NAME && r.head_sha === sha,
  );

  const passed = gateRuns.some((r) => r.conclusion === 'success');
  if (passed) {
    console.log(`Found successful "${GATE_CHECK_NAME}" for ${sha}.`);
    return 0;
  }

  if (gateRuns.length === 0) {
    console.error(
      `No "${GATE_CHECK_NAME}" check run found for ${sha}. Run "E2E Tests for Docker" on this commit first.`,
    );
  } else {
    const statuses = gateRuns.map((r) => `${r.status}/${r.conclusion ?? 'null'}`).join(', ');
    console.error(
      `"${GATE_CHECK_NAME}" exists for ${sha} but did not succeed (${statuses}).`,
    );
  }
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
