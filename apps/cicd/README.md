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
  ],
  "afterEach": [
    { "name": "collect", "command": "bun ci/collect-wdio-report.ts" }
  ],
  "onArtifactsReady": [
    { "name": "check-log", "command": "bun ./apps/e2e/scenarios/check-log.ts" }
  ]
}
```

Top-level `env` is shallow-merged into every background and task subprocess
(after `process.env`, before per-item `env`). Use per-background or per-task
`env` to override a single key.

**taskTimeout:** optional default timeout in milliseconds for tasks that omit
per-task `timeoutMs`. Per-task `timeoutMs` wins when both are set. Unset = no
timeout (same as today).

**cwd:** omitted → project root (`run()` / CLI `--cwd`, default `process.cwd()`).
Relative paths resolve against that project root. Absolute paths are used as-is.

**Hooks:**
- `afterEach` — after each task; `main.log` is not sliced yet. Env: `CICD_TASK_NAME`, `CICD_OUTPUT_DIR`, `CICD_TASK_EXIT_CODE`.
- `onArtifactsReady` — once after log slicing; `{task}/main.log` is available. Env: `CICD_ARTIFACT_DIR` (same as `CICD_OUTPUT_DIR`), `CICD_EXIT_CODE`, `CICD_TASK_NAMES`. A failing hook fails the whole run.
- `when` — on hooks: `always` (default) or `success`. For `onArtifactsReady`, `success` skips the hook unless every task exited 0.

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