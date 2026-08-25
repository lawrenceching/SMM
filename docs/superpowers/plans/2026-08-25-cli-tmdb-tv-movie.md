# CLI `smm tmdb tv` / `smm tmdb movie` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `smm tmdb tv <id>` and `smm tmdb movie <id>` CLI commands that call Core `getTvShowInTmdb` / `getMovieInTmdb` and print either a full human-readable field tree (`default`) or pretty JSON (`json`).

**Architecture:** Mirror existing `smm tmdb search` in `runCli.ts`: Commander subcommands under `tmdb`, forward `--lang`/`--host`/`--password`/`--proxy` into Core `TmdbRequestOptions`, format stdout via a new pure helper. No new HTTP/MCP/AI surface.

**Tech Stack:** TypeScript, Commander 15, Vitest (unit), Bun test under `apps/e2e/cli` (live e2e), Core in-process via `getCore()`.

**Spec:** `docs/superpowers/specs/2026-08-25-cli-tmdb-tv-movie-design.md`

## Global Constraints

- Connection flags must match `search`: `--lang`, `--host`, `--password`, `--proxy` → Core `{ language, host, password, proxy }`.
- `--format` / `-f` choices: `json` | `default`; omitted → `default`.
- `default` prints **all** enumerable fields (no curated subset); `json` uses existing `printJson` (`JSON.stringify(..., null, 2)`).
- Invalid id (non-integer / ≤ 0): stderr + exit 1.
- Prefer extending `apps/e2e/cli/tmdb.test.ts` for live e2e.
- Follow red-green unit testing: fail first, then implement.

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/cli/src/cli/tmdbDetailsFormat.ts` | Pure `formatTmdbDetailsTree(value: unknown): string` |
| `apps/cli/src/cli/tmdbDetailsFormat.test.ts` | Unit tests for tree formatter |
| `apps/cli/src/cli/runCli.ts` | Register `tmdb tv` / `tmdb movie` actions |
| `apps/cli/src/cli/tmdbGet.test.ts` | Command unit tests with mocked `getCore` |
| `apps/e2e/cli/tmdb.test.ts` | Live e2e for tv/movie get (+ existing search) |
| `docs/dev/tmdb.md` | Document tv/movie CLI usage, formats, params |

---

### Task 1: Human-readable details tree formatter

**Files:**
- Create: `apps/cli/src/cli/tmdbDetailsFormat.ts`
- Test: `apps/cli/src/cli/tmdbDetailsFormat.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces: `export function formatTmdbDetailsTree(value: unknown): string`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/src/cli/tmdbDetailsFormat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { formatTmdbDetailsTree } from './tmdbDetailsFormat'

describe('formatTmdbDetailsTree', () => {
  it('formats primitives, null, nested objects, and arrays', () => {
    const text = formatTmdbDetailsTree({
      id: 83095,
      name: 'Wataten',
      overview: null,
      missing: undefined,
      genres: [{ id: 16, name: 'Animation' }],
      episode_run_time: [24],
    })
    expect(text).toBe(
      [
        'id: 83095',
        'name: Wataten',
        'overview: null',
        'genres:',
        '  [0]:',
        '    id: 16',
        '    name: Animation',
        'episode_run_time:',
        '  [0]: 24',
      ].join('\n'),
    )
  })

  it('formats a bare non-object as a single line', () => {
    expect(formatTmdbDetailsTree(42)).toBe('42')
    expect(formatTmdbDetailsTree(null)).toBe('null')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && pnpm exec vitest run src/cli/tmdbDetailsFormat.test.ts`

Expected: FAIL (module not found / `formatTmdbDetailsTree` not exported)

- [ ] **Step 3: Write minimal implementation**

Create `apps/cli/src/cli/tmdbDetailsFormat.ts`:

```typescript
/**
 * Format a TMDB details payload as an indented key/value tree for CLI stdout.
 * Prints every enumerable field; omits `undefined` keys; prints `null` as `null`.
 */
export function formatTmdbDetailsTree(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return formatScalar(value)
  }
  return formatObjectOrArray(value, 0).join('\n')
}

function formatScalar(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return String(value)
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function formatObjectOrArray(value: object, depth: number): string[] {
  const lines: string[] = []
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      lines.push(...formatEntry(`[${i}]`, value[i], depth))
    }
    return lines
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) continue
    lines.push(...formatEntry(key, child, depth))
  }
  return lines
}

function formatEntry(key: string, value: unknown, depth: number): string[] {
  const prefix = `${indent(depth)}${key}:`
  if (value !== null && typeof value === 'object') {
    const children = formatObjectOrArray(value, depth + 1)
    if (children.length === 0) {
      return [`${prefix}`]
    }
    return [`${prefix}`, ...children]
  }
  return [`${prefix} ${formatScalar(value)}`]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/cli && pnpm exec vitest run src/cli/tmdbDetailsFormat.test.ts`

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/tmdbDetailsFormat.ts apps/cli/src/cli/tmdbDetailsFormat.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add TMDB details tree formatter for tmdb tv/movie

EOF
)"
```

---

### Task 2: Wire `tmdb tv` and `tmdb movie` in `runCli`

**Files:**
- Modify: `apps/cli/src/cli/runCli.ts` (after existing `tmdb search` block, before `tvdbCmd`)
- Create: `apps/cli/src/cli/tmdbGet.test.ts`

**Interfaces:**
- Consumes: `formatTmdbDetailsTree` from `./tmdbDetailsFormat`; `getCore().getTvShowInTmdb` / `getMovieInTmdb`
- Produces: Commander actions for `smm tmdb tv` and `smm tmdb movie`

- [ ] **Step 1: Write the failing command tests**

Create `apps/cli/src/cli/tmdbGet.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli } from './runCli'

const mockGetTvShowInTmdb = vi.fn()
const mockGetMovieInTmdb = vi.fn()

vi.mock('../core/getCore', () => ({
  getCore: () => ({
    getTvShowInTmdb: mockGetTvShowInTmdb,
    getMovieInTmdb: mockGetMovieInTmdb,
  }),
}))

const sampleTv = {
  id: 83095,
  name: 'Wataten',
  genres: [{ id: 16, name: 'Animation' }],
}

const sampleMovie = {
  id: 550,
  title: 'Fight Club',
  genres: [{ id: 18, name: 'Drama' }],
}

describe('smm tmdb tv / movie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTvShowInTmdb.mockResolvedValue(sampleTv)
    mockGetMovieInTmdb.mockResolvedValue(sampleMovie)
  })

  it('prints default tree for tv and forwards options', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli([
        'node',
        'smm',
        'tmdb',
        'tv',
        '83095',
        '--lang',
        'zh-CN',
        '--host',
        'https://example.test/3',
        '--password',
        'key',
        '--proxy',
        'socks5://127.0.0.1:1',
      ])
      expect(code).toBe(0)
      expect(mockGetTvShowInTmdb).toHaveBeenCalledWith(83095, {
        language: 'zh-CN',
        host: 'https://example.test/3',
        password: 'key',
        proxy: 'socks5://127.0.0.1:1',
      })
      expect(logs.join('\n')).toContain('id: 83095')
      expect(logs.join('\n')).toContain('name: Wataten')
      expect(logs.join('\n')).toContain('genres:')
    } finally {
      console.log = origLog
    }
  })

  it('prints pretty JSON for movie with -f json', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tmdb', 'movie', '550', '-f', 'json'])
      expect(code).toBe(0)
      expect(mockGetMovieInTmdb).toHaveBeenCalledWith(550, {
        language: undefined,
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
      expect(JSON.parse(logs[0]!)).toEqual(sampleMovie)
    } finally {
      console.log = origLog
    }
  })

  it('rejects invalid id without calling Core', async () => {
    const errors: string[] = []
    const origError = console.error
    console.error = (msg: string) => errors.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tmdb', 'tv', 'abc'])
      expect(code).toBe(1)
      expect(mockGetTvShowInTmdb).not.toHaveBeenCalled()
      expect(errors.join('\n')).toMatch(/id/i)
    } finally {
      console.error = origError
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && pnpm exec vitest run src/cli/tmdbGet.test.ts`

Expected: FAIL (unknown command `tv` / `movie`, or Core never called as asserted)

- [ ] **Step 3: Implement commands in `runCli.ts`**

1. Add import:

```typescript
import { formatTmdbDetailsTree } from './tmdbDetailsFormat'
```

2. Immediately after the `tmdbCmd.command('search')...` block (before `const tvdbCmd = ...`), add:

```typescript
  function registerTmdbGetCommand(
    name: 'tv' | 'movie',
    description: string,
    fetch: (
      id: number,
      options: {
        language?: string
        host?: string
        password?: string
        proxy?: string
      },
    ) => Promise<unknown>,
  ) {
    tmdbCmd
      .command(name)
      .description(description)
      .argument('<tmdbid>', 'TMDB id')
      .addOption(
        new Option('-f, --format <fmt>', 'Output format')
          .choices(['json', 'default'])
          .default('default'),
      )
      .option('--host <url>', 'TMDB API base URL (overrides userConfig.tmdb.host)')
      .option('--password <key>', 'TMDB API key (overrides userConfig.tmdb.apiKey)')
      .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tmdb.httpProxy)')
      .option(
        '--lang <language>',
        'TMDB primary translation IETF tag (static list from /configuration/primary_translations, e.g. zh-CN, en-US, fr-FR); defaults from userConfig then OS locale',
      )
      .action(
        async (
          tmdbIdRaw: string,
          opts: {
            format?: string
            host?: string
            password?: string
            proxy?: string
            lang?: string
          },
        ) => {
          try {
            const id = Number(tmdbIdRaw)
            if (!Number.isInteger(id) || id <= 0) {
              console.error('id must be a positive integer')
              exitCode = 1
              return
            }
            const details = await fetch(id, {
              language: opts.lang,
              host: opts.host,
              password: opts.password,
              proxy: opts.proxy,
            })
            if (opts.format === 'json') {
              printJson(details)
              return
            }
            console.log(formatTmdbDetailsTree(details))
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error))
            exitCode = 1
          }
        },
      )
  }

  registerTmdbGetCommand('tv', 'Get TMDB TV show details by id', (id, options) =>
    getCore().getTvShowInTmdb(id, options),
  )
  registerTmdbGetCommand('movie', 'Get TMDB movie details by id', (id, options) =>
    getCore().getMovieInTmdb(id, options),
  )
```

- [ ] **Step 4: Run unit tests**

Run:

```bash
cd apps/cli && pnpm exec vitest run src/cli/tmdbGet.test.ts src/cli/tmdbDetailsFormat.test.ts
```

Expected: PASS

If `mockGetMovieInTmdb` call options fail because Commander omits undefined keys differently, assert with `expect.objectContaining` or match the exact object Core receives (prefer exact parity with how `search` passes options — include `undefined` fields explicitly in the call object as shown above).

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/runCli.ts apps/cli/src/cli/tmdbGet.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add smm tmdb tv and tmdb movie get-by-id commands

EOF
)"
```

---

### Task 3: Live e2e + docs

**Files:**
- Modify: `apps/e2e/cli/tmdb.test.ts`
- Modify: `docs/dev/tmdb.md`

**Interfaces:**
- Consumes: compiled `bin` from `apps/e2e/cli/base.ts`; live TMDB via `requiredEnv`
- Produces: e2e coverage for get-by-id; updated developer docs

- [ ] **Step 1: Extend live e2e**

Append to `apps/e2e/cli/tmdb.test.ts` (keep existing search suite). Use well-known IDs:

- TV: `83095` (天使降临到我身边 / Wataten) — same title family as search keyword
- Movie: `550` (Fight Club) — classic stable TMDB id

```typescript
describe('tmdb tv / movie get', () => {
    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: () => {},
        })
    })

    afterEach(async () => {
        await cleanup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: true,
        })
    })

    it('gets TV show details (default format) via SMM-provided host', async () => {
        const ret = await $`${bin} tmdb tv 83095 --lang zh-CN`.nothrow()
        expect(ret.exitCode).toBe(0)
        const text = ret.text()
        expect(text).toMatch(/id: 83095/)
        expect(text).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('gets movie details as JSON via custom host', async () => {
        const { host, password, proxy } = officialTmdb()
        const ret = await $`${bin} tmdb movie 550 -f json --host ${host} --password ${password} --proxy ${proxy}`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.id).toBe(550)
        expect(String(body.title ?? '')).toMatch(/Fight Club/i)
    }, FIVE_MINUTES_MS)
})
```

- [ ] **Step 2: Update `docs/dev/tmdb.md` CLI section**

Replace “目前仅暴露搜索子命令：” with text that search + tv + movie are exposed.

Under **输出格式**, add:

```bash
$ smm tmdb tv 83095
id: 83095
name: ...
genres:
  [0]:
    id: ...
    name: ...

$ smm tmdb movie 550 -f json
{
  "id": 550,
  "title": "Fight Club",
  ...
}
```

Under **常用场景**, add:

```bash
smm tmdb tv 83095 --lang zh-CN
smm tmdb movie 550 -f json --host "https://api.themoviedb.org/3" --password "your-api-key" --proxy "socks5://proxy.example.com:7079"
```

Update **参数** table: note `--type` is search-only; `--format` applies to `tv`/`movie` (`json`|`default`).

Update implementation line to mention `tmdbDetailsFormat.ts`.

Update **测试** table row for CLI e2e to mention get-by-id cases in `apps/e2e/cli/tmdb.test.ts`.

- [ ] **Step 3: Run live e2e (requires built CLI + env)**

Prereq: CLI binary built (`pnpm` / existing build so `apps/cli/dist/cli` exists), and `apps/e2e/.env.local` (or env) has `TMDB_HOST`, `TMDB_API_KEY`, `TMDB_HTTP_PROXY` for the custom-host case.

Run:

```bash
cd apps/e2e && bun test ./cli/tmdb.test.ts
```

Expected: all search + new get tests PASS.

Also re-run unit tests:

```bash
cd apps/cli && pnpm exec vitest run src/cli/tmdbDetailsFormat.test.ts src/cli/tmdbGet.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/cli/tmdb.test.ts docs/dev/tmdb.md
git commit -m "$(cat <<'EOF'
test(e2e): cover smm tmdb tv/movie get and update TMDB docs

EOF
)"
```

---

## Self-Review

| Spec requirement | Task |
|------------------|------|
| `smm tmdb tv` / `movie` with format + lang | Task 2 |
| `--host` / `--password` / `--proxy` parity | Task 2 |
| `default` = full human-readable tree | Task 1 + 2 |
| `json` = pretty JSON via `printJson` | Task 2 |
| Invalid id → exit 1 | Task 2 unit test |
| Live e2e | Task 3 |
| Docs update | Task 3 |
| No MCP/HTTP/AI changes | Out of scope (honored) |

No placeholders left. Types: `formatTmdbDetailsTree(value: unknown): string`; Core `(id: number, options?: TmdbRequestOptions) => Promise<TmdbSeriesDetails | TmdbMovieDetails>`.
