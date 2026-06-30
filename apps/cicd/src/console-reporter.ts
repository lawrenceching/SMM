import * as path from 'node:path';
import type { RunResult, TaskRecord } from './types.ts';

export type ConsoleReporterOptions = {
  /** Base directory for displaying relative paths (default: process.cwd()). */
  cwd?: string;
};

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function formatTaskLine(task: TaskRecord): string {
  const duration = formatDuration(task.endTime - task.startTime).padStart(8);
  const label = task.name.padEnd(16);

  if (task.timedOut) {
    return `  ✗ ${label} ${duration}  timed out`;
  }
  if (task.exitCode === 0) {
    return `  ✓ ${label} ${duration}`;
  }
  return `  ✗ ${label} ${duration}  exit ${task.exitCode}`;
}

export class ConsoleReporter {
  constructor(private readonly options: ConsoleReporterOptions = {}) {}

  format(result: RunResult): string {
    const lines: string[] = [];
    const passed = result.taskResults.filter(
      (task) => task.exitCode === 0 && !task.timedOut,
    ).length;
    const total = result.taskResults.length;
    const status = result.exitCode === 0 ? 'PASSED' : 'FAILED';
    const outputPath = this.toDisplayPath(result.outputDir);

    lines.push('');
    lines.push('─'.repeat(52));
    lines.push(`  ${result.name}`);
    lines.push('─'.repeat(52));
    lines.push('');
    lines.push(`Result: ${status} (${passed}/${total} tasks)`);
    lines.push('');
    lines.push('Output:');
    lines.push(`  ${outputPath}`);

    if (total > 0) {
      lines.push('');
      lines.push('Tasks:');
      for (const task of result.taskResults) {
        lines.push(formatTaskLine(task));
      }

      lines.push('');
      lines.push('Logs:');
      for (const task of result.taskResults) {
        lines.push(`  ${task.name}/main.log`);
      }
    }

    lines.push('');
    lines.push(`output: ${result.outputDir}`);

    return lines.join('\n');
  }

  print(result: RunResult): void {
    console.log(this.format(result));
  }

  private toDisplayPath(absolutePath: string): string {
    const cwd = this.options.cwd ?? process.cwd();
    const relative = path.relative(cwd, absolutePath);

    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join('/');
    }

    return absolutePath.split(path.sep).join('/');
  }
}
