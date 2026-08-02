/**
 * Copies WDIO HTML reports and network logs into the cicd output dir after each spec task.
 *
 * Invoked by apps/cicd afterEach hooks. Expects:
 *   CICD_TASK_NAME   — completed task name (e.g. SearchMovie.e2e.ts)
 *   CICD_OUTPUT_DIR  — cicd run output directory
 *
 * Sources (relative to repo root / cwd):
 *   apps/e2e/reports/html-reports/
 *   apps/e2e/reports/network-logs/
 *
 * Destinations:
 *   {CICD_OUTPUT_DIR}/{CICD_TASK_NAME}/wdio-report/
 *   {CICD_OUTPUT_DIR}/{CICD_TASK_NAME}/network-log/
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { redactTextFilesInDir } from './scan-secure-data-lib';

const WDIO_REPORT_REL = path.join('apps', 'e2e', 'reports', 'html-reports');
const NETWORK_LOG_REL = path.join('apps', 'e2e', 'reports', 'network-logs');

function log(message: string): void {
  console.log(`[collect-wdio-report] ${message}`);
}

function hasReportFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).length > 0;
}

function copyReportDir(sourceRel: string, destSubdir: string, taskName: string, outputDir: string): boolean {
  const sourceDir = path.resolve(process.cwd(), sourceRel);
  if (!hasReportFiles(sourceDir)) {
    log(`skip: no reports in ${sourceRel}`);
    return false;
  }

  const destDir = path.join(path.resolve(outputDir), taskName, destSubdir);
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(sourceDir, destDir, { recursive: true, force: true });
  redactTextFilesInDir(destDir);

  // log(`copied ${sourceRel} -> ${path.relative(process.cwd(), destDir)}`);
  return true;
}

function main(): number {
  const taskName = process.env.CICD_TASK_NAME;
  const outputDir = process.env.CICD_OUTPUT_DIR;

  if (!taskName || !outputDir) {
    log('skip: missing CICD_TASK_NAME or CICD_OUTPUT_DIR');
    return 0;
  }

  copyReportDir(WDIO_REPORT_REL, 'wdio-report', taskName, outputDir);
  copyReportDir(NETWORK_LOG_REL, 'network-log', taskName, outputDir);
  return 0;
}

process.exit(main());
