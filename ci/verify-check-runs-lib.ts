/**
 * GitHub check run names required before release.
 * Must match job `name:` values across CI and dispatched workflows.
 */
export const RELEASE_REQUIRED_CHECKS = [
  'Lint UI',
  'build / gate',
  'web-ui-e2e / gate',
  'mcp-tools-e2e / gate',
] as const;

export type ReleaseRequiredCheck = (typeof RELEASE_REQUIRED_CHECKS)[number];

export type CheckRun = {
  name: string;
  conclusion: string | null;
  head_sha: string;
  status: string;
};

export type VerifyCheckRunsResult = {
  ok: boolean;
  missing: string[];
  failed: string[];
};

export function verifyRequiredCheckRuns(
  runs: CheckRun[],
  sha: string,
  requiredNames: readonly string[],
): VerifyCheckRunsResult {
  const missing: string[] = [];
  const failed: string[] = [];

  for (const required of requiredNames) {
    const matching = runs.filter(
      (r) => r.name === required && r.head_sha === sha,
    );
    if (!matching.some((r) => r.conclusion === 'success')) {
      if (matching.length === 0) {
        missing.push(required);
      } else {
        failed.push(required);
      }
    }
  }

  return {
    ok: missing.length === 0 && failed.length === 0,
    missing,
    failed,
  };
}
