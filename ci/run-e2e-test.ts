/**
 * E2E test runner: writes apps/cicd config and runs WebdriverIO.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *   bun ci/run-e2e-test.ts --spec ./common/tv/TVShow-Import.e2e.ts
 *   bun ci/run-e2e-test.ts --platform ohos --spec ./common/tv/TVShow-Import.e2e.ts
 *   bun ci/run-e2e-test.ts --platform electron --spec ./common/tv/TVShow-Import.e2e.ts
 *   bun ci/run-e2e-test.ts --platform docker --spec ./common/movie/SearchMovie.e2e.ts
 *
 * Config: artifacts/e2e/config.json
 * Logs and run summary: apps/cicd/run.ts
 */
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CONFIG_PATH,
  CONFIG_REL_PATH,
  ROOT,
  assertSpecsMatchPlatform,
  buildConfig,
  defaultPatternsForPlatform,
  parseArgv,
  requireSpecsForPlatform,
  specFiles,
} from './run-e2e-test-lib.ts';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const { platform, patterns } = parseArgv(argv);
  requireSpecsForPlatform(platform, patterns);

  const specs = specFiles(
    patterns.length > 0 ? patterns : defaultPatternsForPlatform(platform),
    patterns.length === 0 && platform === 'desktop',
  );
  assertSpecsMatchPlatform(platform, specs);

  const config = buildConfig(platform, specs);

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  const result = await $`bun apps/cicd/run.ts -f ${CONFIG_REL_PATH} --cwd ${ROOT}`
    .cwd(ROOT)
    .env(process.env)
    .nothrow();

  return result.exitCode;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('failed:', error);
    process.exit(1);
  });
