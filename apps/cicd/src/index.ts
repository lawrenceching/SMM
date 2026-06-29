import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseConfig } from './config.ts';
import { runOrchestrator } from './orchestrator.ts';
import type { RunOptions, RunResult } from './types.ts';

export type { RunOptions, RunResult, TaskRecord } from './types.ts';
export type { Config, BackgroundTask, Task, ParseResult, ParseError } from './config.ts';

export async function run(options: RunOptions): Promise<RunResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = path.isAbsolute(options.configPath)
    ? options.configPath
    : path.resolve(cwd, options.configPath);

  let raw: unknown;
  try {
    const content = await fs.promises.readFile(configPath, 'utf8');
    raw = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Failed to read config file ${configPath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const parsed = parseConfig(raw);
  if (!parsed.ok) {
    const formatted = parsed.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(`Invalid config:\n${formatted}`);
  }

  const commandId = String(Math.floor(Date.now() / 1000));
  const result = await runOrchestrator(parsed.config, commandId);

  return {
    exitCode: result.exitCode,
    outputDir: path.resolve(parsed.config.outputDir, String(commandId)),
    taskResults: result.taskResults,
  };
}