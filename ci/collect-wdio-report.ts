/**
 * Copies WDIO HTML reports into the cicd output dir after each spec task.
 *
 * Invoked by apps/cicd afterEach hooks. Expects:
 *   CICD_TASK_NAME   — completed task name (e.g. SearchMovie.e2e.ts)
 *   CICD_OUTPUT_DIR  — cicd run output directory
 *
 * Source: apps/e2e/reports/html-reports/ (relative to repo root / cwd)
 * Dest:   {CICD_OUTPUT_DIR}/{CICD_TASK_NAME}/wdio-report/
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const WDIO_REPORT_REL = path.join('apps', 'e2e', 'reports', 'html-reports');

function log(message: string): void {
  console.log(`[collect-wdio-report] ${message}`);
}

function hasReportFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).length > 0;
}

function main(): number {
  const taskName = process.env.CICD_TASK_NAME;
  const outputDir = process.env.CICD_OUTPUT_DIR;

  if (!taskName || !outputDir) {
    log('skip: missing CICD_TASK_NAME or CICD_OUTPUT_DIR');
    return 0;
  }

  const sourceDir = path.resolve(process.cwd(), WDIO_REPORT_REL);
  if (!hasReportFiles(sourceDir)) {
    log(`skip: no reports in ${WDIO_REPORT_REL}`);
    return 0;
  }

  const destDir = path.join(path.resolve(outputDir), taskName, 'wdio-report');
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(sourceDir, destDir, { recursive: true, force: true });

  log(`copied ${WDIO_REPORT_REL} -> ${path.relative(process.cwd(), destDir)}`);
  return 0;
}

process.exit(main());
