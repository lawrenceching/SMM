/**
 * Copies HarmonyOS e2e device/browser logs into the cicd output dir after each spec task.
 *
 * Invoked by apps/cicd afterEach hooks (ohos profile). Expects:
 *   CICD_TASK_NAME   — completed task name (e.g. TVShow-Import.e2e.ts)
 *   CICD_OUTPUT_DIR  — cicd run output directory
 *
 * Sources (relative to repo root / cwd):
 *   apps/e2e/reports/ohos-hilog/hilog.log
 *   apps/e2e/reports/ohos-hilog/electron.log
 *   apps/e2e/reports/ohos-hilog/frontend-console.log
 *
 * Destinations:
 *   {CICD_OUTPUT_DIR}/{CICD_TASK_NAME}/ohos-log/<same filenames>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const OHOS_HILOG_REL = path.join('apps', 'e2e', 'reports', 'ohos-hilog');

const LOG_FILES = ['hilog.log', 'electron.log', 'frontend-console.log'] as const;

function log(message: string): void {
  console.log(`[collect-ohos-logs] ${message}`);
}

function copyLogFile(
  sourceRelDir: string,
  fileName: string,
  taskName: string,
  outputDir: string,
): boolean {
  const sourcePath = path.resolve(process.cwd(), sourceRelDir, fileName);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    log(`skip: missing ${path.join(sourceRelDir, fileName)}`);
    return false;
  }

  const destDir = path.join(path.resolve(outputDir), taskName, 'ohos-log');
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  fs.copyFileSync(sourcePath, destPath);
  // log(`copied ${path.join(sourceRelDir, fileName)} -> ${path.relative(process.cwd(), destPath)}`);
  return true;
}

function main(): number {
  const taskName = process.env.CICD_TASK_NAME;
  const outputDir = process.env.CICD_OUTPUT_DIR;

  if (!taskName || !outputDir) {
    log('skip: missing CICD_TASK_NAME or CICD_OUTPUT_DIR');
    return 0;
  }

  let copied = 0;
  for (const fileName of LOG_FILES) {
    if (copyLogFile(OHOS_HILOG_REL, fileName, taskName, outputDir)) {
      copied += 1;
    }
  }

  if (copied === 0) {
    log(`skip: no ohos-hilog files for task ${taskName}`);
  }

  return 0;
}

process.exit(main());
