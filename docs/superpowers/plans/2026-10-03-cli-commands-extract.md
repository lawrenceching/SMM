# CLI Commands Extract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every leaf CLI command body out of `runCli.ts` into `apps/cli/src/cli/commands/<leaf>.ts` handlers that return exit codes, leaving Commander wiring only in `runCli.ts`.

**Architecture:** Thin Commander shell in `runCli.ts` calls leaf handlers. Handlers use `console.log`/`console.error`, call `getCore()` / formatters, return `0|1`. No `commander` imports inside `commands/`. Existing `runCli([...])` tests stay the safety net.

**Tech Stack:** TypeScript, Commander, Vitest, `@smm/core`, Bun/pnpm monorepo (`apps/cli`).

**Spec:** `docs/superpowers/specs/2026-10-03-cli-commands-extract-design.md`

## Global Constraints

- One file per leaf under `apps/cli/src/cli/commands/`; flat naming (`planList.ts`, `tmdbSearch.ts`, …).
- Handler signature style matches `add`/`scrape`: `async (...args) => Promise<number>`; use `console`; do not import `commander`.
- Do not change CLI flags, help text, or user-visible stdout/stderr strings.
- Do not add a new unit test per extracted command; verify with existing `apps/cli` vitest suites.
- Keep MCP lazy imports inside `mcpStart` (do not top-level import `@/utils/config` or MCP lifecycle from `runCli`).
- `_context` / `_ports` only on commands that already have them (`add`, `addlib`, `scrape`).
- Prefer implementing `apply`/`reject` once; `planApply`/`planReject` re-export or thin-wrap.
- After each task: run the relevant existing tests listed in that task.

## File Structure

| Path | Responsibility |
|------|----------------|
| `apps/cli/src/cli/commands/shared.ts` | `printJson`, `parseConfigValue`, `resolveFolderType`, `resolveRenameRule`, `FOLDER_TYPES` / rename-rule constants as needed |
| `apps/cli/src/cli/commands/<leaf>.ts` | One leaf handler each (see inventory in spec) |
| `apps/cli/src/cli/runCli.ts` | Commander schema + `exitCode = await handler(...)` only |
| Existing `apps/cli/src/cli/*.test.ts` | Unchanged safety net (call `runCli`) |
| Existing `apps/cli/src/cli/commands/{add,addlib,scrape}.test.ts` | Unchanged |

**Note:** Parent `apps/cli/src/cli/list.ts` re-exports `runCli` — do **not** overwrite it. Command lives at `commands/list.ts`.

---

### Task 1: Extract `shared.ts` and wire existing `add`/`addlib` to it

**Files:**
- Create: `apps/cli/src/cli/commands/shared.ts`
- Modify: `apps/cli/src/cli/commands/add.ts` (replace local `resolveFolderType`)
- Modify: `apps/cli/src/cli/commands/addlib.ts` (same)
- Modify: `apps/cli/src/cli/runCli.ts` (import `printJson`/`parseConfigValue`/`resolveRenameRule` from shared once helpers exist; remove local duplicates when no longer used — may still use them until later tasks finish)

**Interfaces:**
- Produces:
  - `printJson(value: unknown): void`
  - `parseConfigValue(raw: string): unknown`
  - `resolveFolderType(value: string): FolderType`
  - `resolveRenameRule(value: string): RenameRuleName`

- [ ] **Step 1: Create `shared.ts`**

```ts
import type { FolderType, RenameRuleName } from '@smm/core'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']
const RENAME_RULES: readonly RenameRuleName[] = ['plex', 'emby']

export function resolveFolderType(value: string): FolderType {
  if (value === 'anime') return 'tvshow'
  if ((FOLDER_TYPES as readonly string[]).includes(value)) {
    return value as FolderType
  }
  throw new Error(`Invalid folder type: ${value}`)
}

export function resolveRenameRule(value: string): RenameRuleName {
  if ((RENAME_RULES as readonly string[]).includes(value)) {
    return value as RenameRuleName
  }
  throw new Error(`Unsupported rename rule: ${value}`)
}

/** Parse CLI value as JSON when possible; otherwise keep the raw string. */
export function parseConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}
```

- [ ] **Step 2: Update `add.ts` / `addlib.ts` to import `resolveFolderType` from `./shared` and delete their local copies**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/commands/add.test.ts src/cli/commands/addlib.test.ts src/cli/add.test.ts src/cli/addlib.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/shared.ts apps/cli/src/cli/commands/add.ts apps/cli/src/cli/commands/addlib.ts
git commit -m "refactor(cli): extract shared helpers for command handlers"
```

---

### Task 2: Extract simple folder commands — `hello`, `list`, `show`, `metadata`, `rm`

**Files:**
- Create: `apps/cli/src/cli/commands/hello.ts`
- Create: `apps/cli/src/cli/commands/list.ts`
- Create: `apps/cli/src/cli/commands/show.ts`
- Create: `apps/cli/src/cli/commands/metadata.ts`
- Create: `apps/cli/src/cli/commands/rm.ts`
- Modify: `apps/cli/src/cli/runCli.ts` (replace inline action bodies with handler calls)

**Interfaces:**
- Consumes: `printJson` from `./shared` (only if needed; `hello` uses formatters)
- Produces:
  - `hello(options: { format?: string }): Promise<number>`
  - `list(): Promise<number>`
  - `show(folder: string): Promise<number>`
  - `metadata(folder: string, options: { set?: string }): Promise<number>`
  - `rm(folder: string): Promise<number>`

- [ ] **Step 1: Create each handler by moving the current `.action` try/catch body from `runCli.ts`, wrapping so the function returns `0`/`1` instead of mutating outer `exitCode`**

Example `list.ts`:

```ts
import { getCore } from '../../core/getCore'

export async function list(): Promise<number> {
  try {
    const folders = await getCore().getFolders()
    for (const folder of folders) {
      console.log(folder)
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
```

Example `runCli` wiring:

```ts
import { hello } from './commands/hello'
import { list } from './commands/list'
// ...
.action(async () => {
  exitCode = await list()
})
```

`hello`: move body that calls `getCore().hello()`, `formatHelloLines`, optional `printJson`.
`show`: move `resolveShowFolder` / `formatShowFolder` body.
`metadata`: move `isFolderImported` / `readFile` / `setMetadata` / `getMetadata` / `formatMediaMetadata` body (keep `readFile` import in the command file).
`rm`: move `isFolderImported` / `unimportFolder` body.

- [ ] **Step 2: Remove unused imports from `runCli.ts` that only served these commands**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/hello.test.ts src/cli/list.test.ts src/cli/show.test.ts src/cli/metadata.test.ts src/cli/rm.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/hello.ts apps/cli/src/cli/commands/list.ts apps/cli/src/cli/commands/show.ts apps/cli/src/cli/commands/metadata.ts apps/cli/src/cli/commands/rm.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract hello/list/show/metadata/rm command handlers"
```

---

### Task 3: Extract recognize / try-to-recognize / try-to-rename

**Files:**
- Create: `apps/cli/src/cli/commands/recognize.ts`
- Create: `apps/cli/src/cli/commands/tryToRecognize.ts`
- Create: `apps/cli/src/cli/commands/tryToRename.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: `resolveRenameRule` from `./shared`
- Produces:
  - `recognize(folder: string, options: { db?: string; id?: string; yes?: boolean }): Promise<number>`
  - `tryToRecognize(folder: string): Promise<number>`
  - `tryToRename(folder: string, options: { rule: string }): Promise<number>`

- [ ] **Step 1: Create the three handlers from current `runCli` action bodies (preserve `--db`/`--id` together check and `confirmRecognizeCandidate` flow)**

- [ ] **Step 2: Wire `runCli` actions to `exitCode = await recognize(...)` etc.**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/recognize.test.ts src/cli/recognizeConfirm.test.ts
```

Expected: PASS (also run any try-to-* tests if present under `src/cli/`)

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/recognize.ts apps/cli/src/cli/commands/tryToRecognize.ts apps/cli/src/cli/commands/tryToRename.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract recognize and try-to-* command handlers"
```

---

### Task 4: Extract apply / reject / plan*

**Files:**
- Create: `apps/cli/src/cli/commands/apply.ts`
- Create: `apps/cli/src/cli/commands/reject.ts`
- Create: `apps/cli/src/cli/commands/planList.ts`
- Create: `apps/cli/src/cli/commands/planShow.ts`
- Create: `apps/cli/src/cli/commands/planApply.ts`
- Create: `apps/cli/src/cli/commands/planReject.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: `printJson` from `./shared`; `formatPlanListLine`, `formatPlanDetailLines`, `planFileCount` from `../planFormat`
- Produces:
  - `apply(planId: string): Promise<number>`
  - `reject(planId: string): Promise<number>`
  - `planList(folder: string | undefined, options: { all?: boolean; format?: string }): Promise<number>`
  - `planShow(planId: string, options: { format?: string }): Promise<number>`
  - `planApply` / `planReject`: re-export `apply` / `reject` (or thin wrappers calling them)

- [ ] **Step 1: Implement `apply.ts` / `reject.ts` from current `applyPlanById` / `rejectPlanById` helpers (return exit code instead of mutating outer `exitCode`)**

Example `apply.ts`:

```ts
import { getCore } from '../../core/getCore'
import { planFileCount } from '../planFormat'

export async function apply(planId: string): Promise<number> {
  try {
    const plan = await getCore().getPlan(planId)
    await getCore().applyPlan(plan)
    console.log(`applied ${plan.id} (${planFileCount(plan)} file(s))`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
```

- [ ] **Step 2: `planApply.ts` / `planReject.ts`:**

```ts
export { apply as planApply } from './apply'
export { reject as planReject } from './reject'
```

- [ ] **Step 3: Implement `planList` / `planShow`; wire all four plan subcommands plus top-level apply/reject in `runCli`**

- [ ] **Step 4: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/planFormat.test.ts
```

Also run any plan-related CLI tests under `src/cli/` if present.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/commands/apply.ts apps/cli/src/cli/commands/reject.ts apps/cli/src/cli/commands/plan*.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract apply/reject/plan command handlers"
```

---

### Task 5: Extract rename / rename-episode-file

**Files:**
- Create: `apps/cli/src/cli/commands/rename.ts`
- Create: `apps/cli/src/cli/commands/renameEpisodeFile.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: `classifyRenameTarget`, `printEpisodeRenameResult` from `../renameDispatch`; `resolvePathUnderMediaFolder`; `Path` from `@smm/utils/path`
- Produces:
  - `rename(from: string, to: string): Promise<number>`
  - `renameEpisodeFile(folder: string, options: { from: string; to: string }): Promise<number>`

- [ ] **Step 1: Move rename action bodies into handlers; `printEpisodeRenameResult` returning true means exit code 1**

- [ ] **Step 2: Wire `runCli`**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/renameDispatch.test.ts src/cli/resolvePathUnderMediaFolder.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/rename.ts apps/cli/src/cli/commands/renameEpisodeFile.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract rename command handlers"
```

---

### Task 6: Extract job*

**Files:**
- Create: `apps/cli/src/cli/commands/jobList.ts`
- Create: `apps/cli/src/cli/commands/jobLog.ts`
- Create: `apps/cli/src/cli/commands/jobStop.ts`
- Create: `apps/cli/src/cli/commands/jobShow.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: `getLogDir` from `../../utils/config`; `listPersistedImportJobIds`, `readPersistedJobLog`, `persistedJobLogLines`; `formatScrapeJobTaskLines`; `printJson`; `ScrapeJob`
- Produces:
  - `jobList(): Promise<number>`
  - `jobLog(jobId: string): Promise<number>`
  - `jobStop(jobId: string): Promise<number>`
  - `jobShow(jobId: string): Promise<number>` (default `job <id>` action)

- [ ] **Step 1: Move each job subcommand body into its file**

- [ ] **Step 2: Wire `jobCmd` actions in `runCli`**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/job.test.ts src/cli/scrapeJobFormat.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/job*.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract job command handlers"
```

---

### Task 7: Extract tmdb* / tvdb*

**Files:**
- Create: `apps/cli/src/cli/commands/tmdbSearch.ts`
- Create: `apps/cli/src/cli/commands/tmdbTv.ts`
- Create: `apps/cli/src/cli/commands/tmdbMovie.ts`
- Create: `apps/cli/src/cli/commands/tvdbSearch.ts`
- Create: `apps/cli/src/cli/commands/tvdbTv.ts`
- Create: `apps/cli/src/cli/commands/tvdbMovie.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: formatters + `printJson`
- Produces handlers matching current opts (`type`, `host`, `password`, `proxy`, `lang`, `format`)
- Optional internal helper inside each get-command file (or a private helper in `tmdbTv.ts` duplicated carefully) — prefer small shared private helper only if it does not reintroduce Commander coupling. Duplicating the id-validation + fetch + format block between tv/movie is acceptable to keep files independent.

- [ ] **Step 1: Extract search + get handlers; preserve positive-integer id validation and default/json format branches**

- [ ] **Step 2: Delete `registerTmdbGetCommand` / `registerTvdbGetCommand` helpers from `runCli`; wire four get commands explicitly**

- [ ] **Step 3: Run tests**

```bash
cd apps/cli && pnpm exec vitest run src/cli/tmdb.test.ts src/cli/tmdbGet.test.ts src/cli/tvdb.test.ts src/cli/tvdbGet.test.ts src/cli/tmdbSearchFormat.test.ts src/cli/tmdbDetailsFormat.test.ts src/cli/tvdbSearchFormat.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/cli/commands/tmdb*.ts apps/cli/src/cli/commands/tvdb*.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract tmdb/tvdb command handlers"
```

---

### Task 8: Extract config* / mcpStart; finish thinning `runCli`

**Files:**
- Create: `apps/cli/src/cli/commands/configList.ts`
- Create: `apps/cli/src/cli/commands/configGet.ts`
- Create: `apps/cli/src/cli/commands/configSet.ts`
- Create: `apps/cli/src/cli/commands/mcpStart.ts`
- Modify: `apps/cli/src/cli/runCli.ts` (should now only import Commander + command handlers + Option choices constants that remain at the shell layer)

**Interfaces:**
- Consumes: `isUserConfigKey`, `parseConfigValue`, `printJson` for config; lazy `import('@/utils/config')` + `getCore().startMcpServer` / `stopMcpServer` for mcp
- Produces:
  - `configList(): Promise<number>`
  - `configGet(key: string): Promise<number>`
  - `configSet(key: string, value: string): Promise<number>`
  - `mcpStart(options: { host?: string; port?: string }): Promise<number>`

- [ ] **Step 1: Move config list/get/set bodies into handlers**

- [ ] **Step 2: Move MCP start body into `mcpStart.ts`, keeping lazy imports and SIGINT/SIGTERM/SIGBREAK wait loop inside the handler. On start failure, catch and return 1 (today a throw is caught by `runCli` parse try/catch — preserve exit code 1 and error message).**

- [ ] **Step 3: Remove all remaining business-logic helpers and unused imports from `runCli.ts`. Keep `TYPE_CHOICES` / Option `.choices([...])` at the Commander layer.**

- [ ] **Step 4: Full CLI unit test pass**

```bash
cd apps/cli && pnpm exec vitest run src/cli/
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
cd apps/cli && pnpm typecheck
```

Expected: PASS (or project-equivalent script)

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/cli/commands/config*.ts apps/cli/src/cli/commands/mcpStart.ts apps/cli/src/cli/runCli.ts
git commit -m "refactor(cli): extract config/mcp handlers and finish runCli shell"
```

---

## Self-Review

1. **Spec coverage:** All leaf files from the design inventory are listed; shared helpers; alias apply/reject; MCP lazy import; no new per-command tests; behavior-preserving extract — covered by Tasks 1–8.
2. **Placeholders:** None intentional; handlers are defined by moving existing `runCli` bodies with return-code conversion.
3. **Type consistency:** Exit codes are always `Promise<number>`; nested plan apply/reject re-export top-level handlers.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-03-cli-commands-extract.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

You said「开始编码」— reply **1** or **2** (or just “inline”) and I’ll start immediately.
