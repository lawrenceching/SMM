# CLI `smm tvdb tv` / `smm tvdb movie` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `smm tvdb tv <id>` and `smm tvdb movie <id>` that fetch **raw** TVDB v4 `{ extended, translation }` via new Core methods (not MediaMetadata), with ISO 639-3 `--lang`, and print tree/JSON like TMDB get.

**Architecture:** Keep `getTvShowInTvdb` / `getMovieInTvdb` unchanged. Add `getTvdbSeriesById` / `getTvdbMovieById` that call `TvdbClient` extended + translation endpoints. CLI mirrors `tmdb tv|movie` under `tvdbCmd`.

**Tech Stack:** TypeScript, Core + TvdbClient, Commander, Vitest (`apps/core`, `apps/cli`), Bun test (`apps/e2e/cli`).

**Spec:** `docs/superpowers/specs/2026-08-25-cli-tvdb-tv-movie-design.md`

## Global Constraints

- Output is raw API: `{ extended, translation }` — **never** `TvShowMediaMetadata` / `MovieMediaMetadata`.
- `--lang` is ISO 639-3 only (`zho`, `eng`, …); `zh-CN` must fail via `parseTvdbSearchLanguage`.
- Do not change existing MediaMetadata getters or AI/MCP/HTTP wiring for them.
- Reuse `formatTmdbDetailsTree` + `printJson` for CLI output.
- Connection flags: `--host` / `--password` / `--proxy` / `--lang` same option names as `tvdb search`.
- E2e stable IDs: series `355969` (天使降临到我身边 / Wataten), movie `116` (The Dark Knight).

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/Core.ts` | `getTvdbSeriesById` / `getTvdbMovieById` |
| `apps/core/src/Core.test.ts` | Unit tests for new methods + lang rejection |
| `apps/cli/src/cli/runCli.ts` | Register `tvdb tv` / `tvdb movie` |
| `apps/cli/src/cli/tvdbGet.test.ts` | CLI unit tests (mock Core) |
| `apps/e2e/cli/tvdb.test.ts` | Live e2e get cases |
| `docs/dev/tvdb.md` | Document commands + ISO 639-3 vs MediaMetadata getters |

---

### Task 1: Core `getTvdbSeriesById` / `getTvdbMovieById`

**Files:**
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts`
- Export type from Core if useful: `TvdbByIdResult`

**Interfaces:**
- Consumes: `TvdbClient.getSeriesExtended`, `getSeriesTranslation`, `getMovieExtended`, `getMovieTranslation`; `createTvdbClient`
- Produces:

```typescript
export type TvdbByIdResult = {
  extended: unknown
  translation: unknown | null
}

async getTvdbSeriesById(id: number, options?: TvdbRequestOptions): Promise<TvdbByIdResult>
async getTvdbMovieById(id: number, options?: TvdbRequestOptions): Promise<TvdbByIdResult>
```

- [ ] **Step 1: Write failing Core tests**

In `apps/core/src/Core.test.ts`, add (after existing TVDB get describe, or new describe):

```typescript
describe("Core.getTvdbSeriesById / getTvdbMovieById", () => {
  it("returns raw extended + translation for series", async () => {
    const core = new Core({
      fs: inMemoryFs({ [userConfigPath("/data/smm")]: JSON.stringify({ folders: [], tmdb: {}, tvdb: {} }) }),
      network: { fetch: async (url) => tvdbResponse(url) },
      appDataDir: "/data/smm",
    });
    const result = await core.getTvdbSeriesById(1, { language: "eng" });
    expect(result.extended).toMatchObject({ id: 1, name: "My Show" });
    expect(result.translation).toEqual({ name: "My Show" });
    expect(result).not.toHaveProperty("database");
  });

  it("returns raw extended + translation for movie", async () => {
    const core = new Core({
      fs: inMemoryFs({ [userConfigPath("/data/smm")]: JSON.stringify({ folders: [], tmdb: {}, tvdb: {} }) }),
      network: { fetch: async (url) => tvdbResponse(url) },
      appDataDir: "/data/smm",
    });
    const result = await core.getTvdbMovieById(2, { language: "eng" });
    expect(result.extended).toMatchObject({ id: 2, name: "My Film" });
    expect(result.translation).toEqual({ name: "My Film" });
  });

  it("rejects IETF language tags (ISO 639-3 only)", async () => {
    const core = new Core({
      fs: inMemoryFs({ [userConfigPath("/data/smm")]: JSON.stringify({ folders: [], tmdb: {}, tvdb: {} }) }),
      network: emptyNetwork(),
      appDataDir: "/data/smm",
    });
    await expect(core.getTvdbSeriesById(1, { language: "zh-CN" })).rejects.toThrow(/ISO 639-3/);
  });

  it("validates id as a positive integer", async () => {
    const core = new Core({
      fs: inMemoryFs({ [userConfigPath("/data/smm")]: JSON.stringify({ folders: [], tmdb: {}, tvdb: {} }) }),
      network: emptyNetwork(),
      appDataDir: "/data/smm",
    });
    await expect(core.getTvdbSeriesById(0)).rejects.toThrow(/positive integer/);
    await expect(core.getTvdbMovieById(-1)).rejects.toThrow(/positive integer/);
  });

  it("sets translation null when translation endpoint has no data", async () => {
    const core = new Core({
      fs: inMemoryFs({ [userConfigPath("/data/smm")]: JSON.stringify({ folders: [], tmdb: {}, tvdb: {} }) }),
      network: {
        fetch: async (url) => {
          if (url.includes("/translations/zho")) {
            return jsonResponse({ status: "success", data: null });
          }
          return tvdbResponse(url);
        },
      },
      appDataDir: "/data/smm",
    });
    // Need series/1/extended still served; add zho path handling:
    // If tvdbResponse throws on /translations/zho, the override above handles it.
    // Also need /series/1/extended — tvdbResponse already has it.
    // For language zho, login + extended + translation/zho.
    const result = await core.getTvdbSeriesById(1, { language: "zho" });
    expect(result.extended).toMatchObject({ id: 1 });
    expect(result.translation).toBeNull();
  });
});
```

If `tvdbResponse` throws on `/series/1/translations/zho`, the override in the last test is required. Optionally extend `tvdbResponse` with a zho translation fixture instead.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/core && pnpm exec vitest run src/Core.test.ts -t "getTvdbSeriesById"`

Expected: FAIL (methods missing)

- [ ] **Step 3: Implement Core methods**

In `apps/core/src/Core.ts`, near other TVDB methods:

```typescript
export type TvdbByIdResult = {
  extended: unknown;
  translation: unknown | null;
};

async getTvdbSeriesById(id: number, options: TvdbRequestOptions = {}): Promise<TvdbByIdResult> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("id must be a positive integer");
  }
  const { client, language } = await this.createTvdbClient(options);
  const extended = await client.getSeriesExtended(id);
  if (!extended) {
    throw new Error(`Failed to get TVDB series ${id}`);
  }
  const translation = (await client.getSeriesTranslation(id, language)) ?? null;
  return { extended, translation };
}

async getTvdbMovieById(id: number, options: TvdbRequestOptions = {}): Promise<TvdbByIdResult> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("id must be a positive integer");
  }
  const { client, language } = await this.createTvdbClient(options);
  const extended = await client.getMovieExtended(id);
  if (!extended) {
    throw new Error(`Failed to get TVDB movie ${id}`);
  }
  const translation = (await client.getMovieTranslation(id, language)) ?? null;
  return { extended, translation };
}
```

Export `TvdbByIdResult` from `apps/core/src/index.ts` if other packages need it (CLI can use inferred return).

- [ ] **Step 4: Run Core tests — expect PASS**

Run: `cd apps/core && pnpm exec vitest run src/Core.test.ts -t "getTvdbSeriesById|getTvdbMovieById|getTvShowInTvdb"`

Expected: new tests PASS; existing MediaMetadata get tests still PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts apps/core/src/Core.test.ts apps/core/src/index.ts
git commit -m "$(cat <<'EOF'
feat(core): add getTvdbSeriesById/getTvdbMovieById raw API helpers

EOF
)"
```

---

### Task 2: Wire `tvdb tv` / `tvdb movie` in CLI

**Files:**
- Modify: `apps/cli/src/cli/runCli.ts`
- Create: `apps/cli/src/cli/tvdbGet.test.ts`

**Interfaces:**
- Consumes: `getCore().getTvdbSeriesById` / `getTvdbMovieById`; `formatTmdbDetailsTree`; `printJson`
- Produces: Commander actions for `smm tvdb tv` / `smm tvdb movie`

- [ ] **Step 1: Write failing CLI tests**

Create `apps/cli/src/cli/tvdbGet.test.ts` (mirror `tmdbGet.test.ts`):

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli } from './runCli'

const mockGetTvdbSeriesById = vi.fn()
const mockGetTvdbMovieById = vi.fn()

vi.mock('../core/getCore', () => ({
  getCore: () => ({
    getTvdbSeriesById: mockGetTvdbSeriesById,
    getTvdbMovieById: mockGetTvdbMovieById,
  }),
}))

const sampleSeries = {
  extended: { id: 355969, name: 'Wataten' },
  translation: { name: '天使降临到我身边！' },
}

const sampleMovie = {
  extended: { id: 116, name: 'The Dark Knight' },
  translation: { name: 'The Dark Knight' },
}

describe('smm tvdb tv / movie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTvdbSeriesById.mockResolvedValue(sampleSeries)
    mockGetTvdbMovieById.mockResolvedValue(sampleMovie)
  })

  it('prints default tree for tv and forwards ISO 639-3 lang + connection options', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli([
        'node', 'smm', 'tvdb', 'tv', '355969',
        '--lang', 'zho',
        '--host', 'https://tvdb.example/v4',
        '--password', 'key',
        '--proxy', 'socks5://127.0.0.1:1',
      ])
      expect(code).toBe(0)
      expect(mockGetTvdbSeriesById).toHaveBeenCalledWith(355969, {
        language: 'zho',
        host: 'https://tvdb.example/v4',
        password: 'key',
        proxy: 'socks5://127.0.0.1:1',
      })
      const out = logs.join('\n')
      expect(out).toContain('extended:')
      expect(out).toContain('translation:')
      expect(out).not.toMatch(/^database:/m)
    } finally {
      console.log = origLog
    }
  })

  it('prints pretty JSON for movie with -f json', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tvdb', 'movie', '116', '-f', 'json'])
      expect(code).toBe(0)
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
      const code = await runCli(['node', 'smm', 'tvdb', 'tv', 'abc'])
      expect(code).toBe(1)
      expect(mockGetTvdbSeriesById).not.toHaveBeenCalled()
      expect(errors.join('\n')).toMatch(/id/i)
    } finally {
      console.error = origError
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/cli && pnpm exec vitest run src/cli/tvdbGet.test.ts`

Expected: unknown command `tv` / `movie`

- [ ] **Step 3: Register commands in `runCli.ts`**

After `tvdbCmd.command('search')...` block, add a helper analogous to `registerTmdbGetCommand`:

```typescript
  function registerTvdbGetCommand(
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
    tvdbCmd
      .command(name)
      .description(description)
      .argument('<tvdbid>', 'TVDB id')
      .addOption(
        new Option('-f, --format <fmt>', 'Output format')
          .choices(['json', 'default'])
          .default('default'),
      )
      .option('--host <url>', 'TVDB API base URL (overrides userConfig.tvdb.host)')
      .option('--password <key>', 'TVDB API key (overrides userConfig.tvdb.apiKey)')
      .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tvdb.httpProxy)')
      .option(
        '--lang <language>',
        'TVDB ISO 639-3 language code (static list, e.g. eng, zho, yue); defaults from userConfig then OS locale',
      )
      .action(
        async (
          tvdbIdRaw: string,
          opts: {
            format?: string
            host?: string
            password?: string
            proxy?: string
            lang?: string
          },
        ) => {
          try {
            const id = Number(tvdbIdRaw)
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

  registerTvdbGetCommand('tv', 'Get TVDB series details by id (raw API)', (id, options) =>
    getCore().getTvdbSeriesById(id, options),
  )
  registerTvdbGetCommand('movie', 'Get TVDB movie details by id (raw API)', (id, options) =>
    getCore().getTvdbMovieById(id, options),
  )
```

- [ ] **Step 4: Run CLI unit tests — expect PASS**

```bash
cd apps/cli && pnpm exec vitest run src/cli/tvdbGet.test.ts src/cli/tmdbGet.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/runCli.ts apps/cli/src/cli/tvdbGet.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add smm tvdb tv and tvdb movie raw get-by-id commands

EOF
)"
```

---

### Task 3: Live e2e + docs

**Files:**
- Modify: `apps/e2e/cli/tvdb.test.ts`
- Modify: `docs/dev/tvdb.md`

**Interfaces:**
- Consumes: rebuilt `bin`; env `TVDB_*` for custom-host cases
- Produces: e2e coverage; updated docs

- [ ] **Step 1: Extend `apps/e2e/cli/tvdb.test.ts`**

Append (keep search suite). Use IDs `355969` (series) and `116` (movie):

```typescript
describe('tvdb tv / movie get', () => {
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

    it('gets series details (default) via SMM host with --lang zho', async () => {
        const ret = await $`${bin} tvdb tv 355969 --lang zho`.nothrow()
        expect(ret.exitCode).toBe(0)
        const text = ret.text()
        expect(text).toMatch(/extended:/)
        expect(text).toMatch(/translation:/)
        expect(text).toMatch(/id: 355969/)
        expect(text).toMatch(SERIES_TITLE)
        expect(text).not.toMatch(/^database: TVDB$/m)
    }, FIVE_MINUTES_MS)

    it('gets series as JSON via custom host', async () => {
        const { host, password, proxy } = officialTvdb()
        const ret = await $`${bin} tvdb tv 355969 -f json --lang zho --host ${host} --password ${password} --proxy ${proxy}`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.extended).toBeTruthy()
        expect(body.extended.id).toBe(355969)
        expect(body).toHaveProperty('translation')
        expect(body).not.toHaveProperty('database')
    }, FIVE_MINUTES_MS)

    it('gets movie details as JSON via SMM host', async () => {
        const ret = await $`${bin} tvdb movie 116 -f json --lang eng`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.extended.id).toBe(116)
        expect(String(body.extended.name ?? body.translation?.name ?? '')).toMatch(/Dark Knight/i)
    }, FIVE_MINUTES_MS)

    it('rejects IETF --lang zh-CN', async () => {
        const ret = await $`${bin} tvdb tv 355969 --lang zh-CN`.nothrow()
        expect(ret.exitCode).toBe(1)
        const err = ret.stderr.toString() || ret.text()
        expect(err).toMatch(/ISO 639-3/i)
    }, FIVE_MINUTES_MS)

    it('rejects invalid id', async () => {
        const ret = await $`${bin} tvdb tv abc`.nothrow()
        expect(ret.exitCode).toBe(1)
        const err = ret.stderr.toString() || ret.text()
        expect(err).toMatch(/id must be a positive integer/i)
    }, FIVE_MINUTES_MS)
})
```

- [ ] **Step 2: Update `docs/dev/tvdb.md` CLI section**

- State search + `tv` / `movie` are exposed.
- Document commands, `{ extended, translation }` output, ISO 639-3 `--lang` (contrast: search lang = primary filter; get lang = translation).
- Explicitly note: these CLI gets are **raw TVDB API**, distinct from `getTvShowInTvdb` / `getMovieInTvdb` MediaMetadata helpers.
- Update 测试 table to mention get-by-id e2e.

- [ ] **Step 3: Rebuild CLI + run e2e**

```bash
cd apps/cli && pnpm run build
cd ../e2e && bun test ./cli/tvdb.test.ts -t "tvdb tv / movie get"
```

Expected: all new get tests PASS.

Also: `cd apps/core && pnpm exec vitest run src/Core.test.ts -t "getTvdbSeriesById|getTvdbMovieById"`

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/cli/tvdb.test.ts docs/dev/tvdb.md
git commit -m "$(cat <<'EOF'
test(e2e): cover smm tvdb tv/movie get and update TVDB docs

EOF
)"
```

---

## Self-Review

| Spec requirement | Task |
|------------------|------|
| Raw `{ extended, translation }` | Task 1 |
| ISO 639-3 only; reject `zh-CN` | Task 1 + 3 |
| Keep MediaMetadata getters unchanged | Task 1 (no edits to those methods) |
| CLI `tvdb tv` / `movie` + format/flags | Task 2 |
| E2e + docs | Task 3 |

No placeholders. Method names match design: `getTvdbSeriesById` / `getTvdbMovieById`.
