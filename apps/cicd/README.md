# @smm/cicd

General-purpose, JSON-config-driven task runner.

Runs background processes, executes tasks serially against them, captures
stdout/stderr on a unified JSONL timeline, and slices per-task plain-text
log files at the end.

## Usage

```bash
# From repo root:
bun apps/cicd/run.ts -f apps/cicd/examples/sample.json

# From anywhere with a config file:
bun /path/to/apps/cicd/run.ts -f ./my-config.json --cwd .
```

## Programmatic

```typescript
import { run } from '@smm/cicd';

const result = await run({
  configPath: './my-config.json',
  cwd: process.cwd(),
});

console.log(result.exitCode, result.outputDir, result.taskResults);
```

## Config

See `docs/superpowers/specs/2026-06-30-apps-cicd-design.md` for the
full schema and semantics. Minimal example:

```json
{
  "name": "smoke",
  "env": {
    "NODE_ENV": "test"
  },
  "background": [
    { "name": "server", "command": "pnpm dev", "delayMs": 5000 }
  ],
  "tasks": [
    { "name": "test", "command": "pnpm test" }
  ]
}
```

Top-level `env` is shallow-merged into every background and task subprocess
(after `process.env`, before per-item `env`). Use per-background or per-task
`env` to override a single key.

## Output

```
artifacts/cicd/<commandId>/
├── _timeline/                      (preserved unless keepRawTimeline=false)
│   ├── server.jsonl
│   └── test.jsonl
└── test/
    ├── main.log                    ← test's own stdout/stderr (plain text)
    └── server.log                  ← "server" output during test window
```

## Tests

```bash
cd apps/cicd
bun test
pnpm typecheck
```