import { Glob } from 'bun';
import * as path from 'node:path';
import type { Config, Task } from '../apps/cicd/src/config.ts';

const DEFAULT_SPEC_GLOB = 'test/specs/**/*.ts';
const WDIO_ENV = { BROWSER_LOG_ENABLED: 'true' };

export type ParsedWdioArgs = {
  specPatterns: string[];
  otherArgs: string[];
};

export function parseWdioArgs(argv: string[]): ParsedWdioArgs {
  const specPatterns: string[] = [];
  const otherArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === '--spec') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --spec');
      }
      specPatterns.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--spec=')) {
      const value = arg.slice('--spec='.length);
      if (!value) {
        throw new Error('Missing value for --spec');
      }
      specPatterns.push(value);
      continue;
    }

    otherArgs.push(arg);
  }

  return { specPatterns, otherArgs };
}

export function expandSpecPatterns(
  patterns: string[],
  e2eRoot: string,
): string[] {
  const files = new Set<string>();

  for (const pattern of patterns) {
    const normalized = pattern.replace(/\\/g, '/');
    const glob = new Glob(normalized);

    for (const match of glob.scanSync({ cwd: e2eRoot, absolute: false })) {
      if (match.endsWith('.ts')) {
        files.add(match.replace(/\\/g, '/').replace(/^\.\//, ''));
      }
    }
  }

  const resolved = [...files].sort();
  if (resolved.length === 0) {
    throw new Error(
      `No spec files matched: ${patterns.join(', ')} (cwd: ${e2eRoot})`,
    );
  }

  return resolved;
}

export function taskNamesForSpecs(specPaths: string[]): string[] {
  const used = new Set<string>();
  const names: string[] = [];

  for (const specPath of specPaths) {
    const baseName = path.posix.basename(specPath);
    let name = baseName;

    if (used.has(name)) {
      const relative = specPath.replace(/\.ts$/, '');
      name = relative.replace(/\//g, '-');
    }

    if (used.has(name)) {
      throw new Error(`Duplicate task name for spec: ${specPath}`);
    }

    used.add(name);
    names.push(name);
  }

  return names;
}

function quoteForShell(value: string): string {
  if (/[\s"'*%]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function buildWdioCommand(specPath: string, otherArgs: string[]): string {
  const wdioArgs = [
    ...otherArgs,
    '--spec',
    quoteForShell(`./${specPath}`),
  ];
  return `pnpm wdio ${wdioArgs.join(' ')}`;
}

function buildWdioTasks(
  specPaths: string[],
  otherArgs: string[],
  e2eCwd: string,
): Task[] {
  const taskNames = taskNamesForSpecs(specPaths);

  return specPaths.map((specPath, index) => ({
    name: taskNames[index]!,
    command: buildWdioCommand(specPath, otherArgs),
    cwd: e2eCwd,
    env: WDIO_ENV,
  }));
}

export function buildE2eConfig(wdioArgs: string[], repoRoot: string): Config {
  const e2eRoot = path.join(repoRoot, 'apps/e2e');
  const { specPatterns, otherArgs } = parseWdioArgs(wdioArgs);
  const patterns =
    specPatterns.length > 0 ? specPatterns : [DEFAULT_SPEC_GLOB];
  const specPaths = expandSpecPatterns(patterns, e2eRoot);

  return {
    name: 'smm-e2e',
    outputDir: './artifacts/cicd',
    background: [
      { name: 'cli', command: 'pnpm dev:cli', cwd: repoRoot },
      { name: 'ui', command: 'pnpm dev:ui', cwd: repoRoot },
    ],
    tasks: [
      {
        name: 'wait-ready',
        command: 'bun ci/wait-for-e2e-ready.ts',
        cwd: repoRoot,
      },
      ...buildWdioTasks(specPaths, otherArgs, e2eRoot),
    ],
    stopOnFailure: true,
    keepRawTimeline: true,
  };
}
