# MCP Tools Call E2E Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port existing `test/mcp/` tools/call e2e coverage into `apps/e2e/mcp/` (Vitest + built CLI), one file per tool, then delete `test/mcp/`.

**Architecture:** Extend `apps/e2e/mcp/lib` with `callTool` and `testSetup` (lifted from `test/mcp/lib`), convert each Bun test to Vitest against `useMcpServer` / built `cli mcp start`, split grouped suites into per-tool files, retarget scripts/knip, delete the old tree.

**Tech Stack:** Vitest 4, Node `execFile`, `@modelcontextprotocol/inspector` CLI, built `apps/cli/dist/cli[.exe]`, fixtures from `@smm/test` + `test/media` + `test/templates/mediaMetadatas`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-13-mcp-tools-call-e2e-design.md`.
- Built binary only — never spawn `bun apps/cli/index.ts` for these tests.
- Inspector via `node <launcher>` + `execFile` — never `npx`.
- One Vitest file per ported tool; keep `tools-list.test.ts` and port `start-stop-mcp-server-in-cli.test.ts`.
- Out of scope this pass: TVDB tools, `rename-episode-file`, `create-rename-episode-plan`, `create-recognize-episode-plan`.
- Keep `test/mcp-test-client/` and WDIO MCP specs unchanged.
- No production MCP server code changes.
- After code changes: build CLI if needed (`pnpm --filter cli run build`) before running MCP e2e.
- Commit only when a plan step says to commit and the user has authorized plan execution that includes commits.

---

## File Map

**Create:**
- `apps/e2e/mcp/lib/testSetup.ts` — port from `test/mcp/lib/testSetup.ts` (+ shared `seedRecognizedTvShowFolder`)
- `apps/e2e/mcp/lib/tmdbTestHelpers.ts` — TMDB env + retry helpers
- `apps/e2e/mcp/<tool>.test.ts` — one file per ported tool (see Task list)
- `apps/e2e/mcp/start-stop-mcp-server-in-cli.test.ts` — lifecycle (built binary)

**Modify:**
- `apps/e2e/mcp/lib/mcpInspectorClient.ts` — add `McpCallResult` + `callTool`
- `apps/e2e/mcp/README.md` — run instructions + file map
- `package.json` — `"e2e:mcp": "bun ci/run-mcp-e2e-test.ts"`
- `knip.json` — remove `test/mcp/**` entry/ignore

**Delete (final task):**
- Entire `test/mcp/` tree

**Reference (read-only while porting, then delete):**
- `test/mcp/*.test.ts`, `test/mcp/lib/*`
- `docs/superpowers/specs/2026-10-13-mcp-tools-call-e2e-design.md`

---

### Task 1: Add `callTool` to mcpInspectorClient

**Files:**
- Modify: `apps/e2e/mcp/lib/mcpInspectorClient.ts`
- Test: `apps/e2e/mcp/readme.test.ts` (created in this task as the first consumer)

**Interfaces:**
- Consumes: existing `resolveInspectorLauncher()`, `listTools`
- Produces:
  - `export interface McpCallResult { structuredContent: Record<string, unknown> | null; isError: boolean; textContent: string | null; stdout: string; exitCode: number }`
  - `export async function callTool(mcpUrl: string, toolName: string, args?: Record<string, unknown>): Promise<McpCallResult>`

- [ ] **Step 1: Write failing `readme.test.ts`**

Create `apps/e2e/mcp/readme.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Server - ReadmeTool', () => {
  const ctx = useMcpServer()

  test('should return README markdown', async () => {
    const r = await callTool(ctx.url, 'readme')
    expect(r.isError).toBe(false)
    expect(r.structuredContent).not.toBeNull()
    expect(r.structuredContent!.text).toContain('Simple Media Manager (SMM)')
    expect(r.structuredContent!.text).toContain('## 核心概念')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Prerequisite: `pnpm --filter cli run build` if `apps/cli/dist/cli[.exe]` missing.

Run: `bun ci/run-mcp-e2e-test.ts ./mcp/readme.test.ts`

Expected: FAIL — `callTool` is not exported / not a function.

- [ ] **Step 3: Implement `callTool`**

Append to `apps/e2e/mcp/lib/mcpInspectorClient.ts` (keep existing `listTools`; reuse `resolveInspectorLauncher` and `execFileAsync`):

```ts
export interface McpCallResult {
  structuredContent: Record<string, unknown> | null
  isError: boolean
  textContent: string | null
  stdout: string
  exitCode: number
}

/**
 * Call an MCP tool through the MCP Inspector CLI (`--cli --method tools/call`).
 */
export async function callTool(
  mcpUrl: string,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<McpCallResult> {
  const launcher = resolveInspectorLauncher()
  const argv = [
    launcher,
    '--cli',
    '--server-url',
    mcpUrl,
    '--method',
    'tools/call',
    '--tool-name',
    toolName,
    '--format',
    'json',
  ]
  if (args !== undefined) {
    argv.push('--tool-args-json', JSON.stringify(args))
  }

  let stdout = ''
  let exitCode = 0
  try {
    const res = await execFileAsync('node', argv, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
    stdout = res.stdout
    exitCode = 0
  } catch (err: unknown) {
    const e = err as { stdout?: string; code?: number }
    stdout = e.stdout ?? ''
    exitCode = typeof e.code === 'number' ? e.code : 1
  }

  let parsed: {
    result?: {
      content?: Array<{ type: string; text?: string }>
      structuredContent?: Record<string, unknown>
      isError?: boolean
    }
  } | null = null
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    parsed = null
  }

  const result = parsed?.result
  const textContent =
    result?.content?.find((c) => c.type === 'text' && typeof c.text === 'string')?.text ?? null

  const failedToParse = parsed === null && (exitCode !== 0 || stdout.length === 0)

  return {
    structuredContent: result?.structuredContent ?? null,
    isError: (result?.isError ?? false) || failedToParse,
    textContent,
    stdout,
    exitCode,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun ci/run-mcp-e2e-test.ts ./mcp/readme.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/mcp/lib/mcpInspectorClient.ts apps/e2e/mcp/readme.test.ts
git commit -m "$(cat <<'EOF'
feat(e2e): add MCP callTool helper and readme tool test

EOF
)"
```

---

### Task 2: Port `testSetup` + shared seed helper

**Files:**
- Create: `apps/e2e/mcp/lib/testSetup.ts`
- Test: exercised by Task 3+ (filesystem tools)

**Interfaces:**
- Consumes: `@smm/test` folder fixtures, `@smm/types`, `@smm/utils/path`, `test/media`, `test/templates/mediaMetadatas`
- Produces: same exports as `test/mcp/lib/testSetup.ts`, plus:

```ts
export async function seedRecognizedTvShowFolder(
  ctx: { userDataDir: string; appDataDir: string },
  folder: TestFolder,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<{ path: string; cleanup: () => Promise<void> }>
```

`repoRoot()` must resolve from `apps/e2e/mcp/lib/` → four levels up (same as `mcpServer.repoRoot()`), **not** `import.meta.dir` three levels (that was for `test/mcp/lib`).

- [ ] **Step 1: Create `apps/e2e/mcp/lib/testSetup.ts`**

Copy `test/mcp/lib/testSetup.ts` with these edits:

1. Replace `repoRoot()` with:

```ts
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const libDir = dirname(fileURLToPath(import.meta.url))

export function repoRoot(): string {
  return resolve(libDir, '..', '..', '..', '..')
}
```

(Or re-export `repoRoot` from `./mcpServer` to avoid duplication.)

2. Append shared seed helper:

```ts
const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'

export async function seedRecognizedTvShowFolder(
  ctx: { userDataDir: string; appDataDir: string },
  folder: TestFolder,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const media = await setupTestMediaFolders()
  const created = media.materialize(folder)
  await writeUserConfig(ctx.userDataDir, { folders: [created.path!] })
  await seedMediaMetadata(ctx.appDataDir, created, TV_SHOW_METADATA_TEMPLATE, updateMediaMetadata)
  return { path: created.path!, cleanup: () => media.cleanup() }
}
```

Keep all other functions (`writeUserConfig`, `seedMediaMetadata`, `setupTestMediaFolders`, folder re-exports, etc.) identical in behavior to `test/mcp/lib/testSetup.ts`.

- [ ] **Step 2: Smoke-check import**

Run from `apps/e2e`:

```bash
pnpm exec vitest run --config vitest.mcp.config.ts ./mcp/readme.test.ts
```

Expected: still PASS (no breakage).

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/lib/testSetup.ts
git commit -m "$(cat <<'EOF'
feat(e2e): port MCP testSetup fixtures into apps/e2e/mcp

EOF
)"
```

---

### Task 3: Port static-text / prompt tools

**Files:**
- Create: `apps/e2e/mcp/how-to-rename-episode-video-files.test.ts`
- Create: `apps/e2e/mcp/how-to-recognize-episode-video-files.test.ts`
- Keep: `apps/e2e/mcp/readme.test.ts` (already done)

**Interfaces:**
- Consumes: `callTool`, `useMcpServer`
- Produces: three passing Vitest files

- [ ] **Step 1: Write the two how-to tests**

`apps/e2e/mcp/how-to-rename-episode-video-files.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Prompts - HowToRenameEpisodeVideoFilesTool', () => {
  const ctx = useMcpServer()

  test('should return guideline markdown', async () => {
    const r = await callTool(ctx.url, 'how-to-rename-episode-video-files')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.structuredContent!.text).toContain('create-rename-episode-plan')
  })
})
```

`apps/e2e/mcp/how-to-recognize-episode-video-files.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Prompts - HowToRecognizeEpisodeVideoFilesTool', () => {
  const ctx = useMcpServer()

  test('should return guideline markdown', async () => {
    const r = await callTool(ctx.url, 'how-to-recognize-episode-video-files')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.text).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(r.structuredContent!.text).toContain('create-recognize-episode-plan')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/how-to-rename-episode-video-files.test.ts ./mcp/how-to-recognize-episode-video-files.test.ts ./mcp/readme.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/how-to-rename-episode-video-files.test.ts apps/e2e/mcp/how-to-recognize-episode-video-files.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP how-to prompt tool e2e tests

EOF
)"
```

---

### Task 4: Port FS / app-context tools

**Files:**
- Create: `apps/e2e/mcp/get-app-context.test.ts`
- Create: `apps/e2e/mcp/get-media-folders.test.ts`
- Create: `apps/e2e/mcp/is-folder-exist.test.ts`
- Create: `apps/e2e/mcp/list-files.test.ts`

**Interfaces:**
- Consumes: `callTool`, `useMcpServer`, `setupTestMediaFolders`, `writeUserConfig`, `folder1` from `./lib/testSetup`

- [ ] **Step 1: Write the four test files**

`get-app-context.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP AppData - GetApplicationContextTool', () => {
  const ctx = useMcpServer()

  test('should return context fields', async () => {
    const r = await callTool(ctx.url, 'get-app-context')
    expect(r.isError).toBe(false)
    const sc = r.structuredContent!
    expect(sc).toHaveProperty('selectedMediaFolder')
    expect(sc).toHaveProperty('language')
  })
})
```

`get-media-folders.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, writeUserConfig, folder1 } from './lib/testSetup'

describe('MCP AppData - GetMediaFoldersTool', () => {
  const ctx = useMcpServer()

  test('should return folders field, updated after import', async () => {
    let r = await callTool(ctx.url, 'get-media-folders')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.folders).toEqual([])

    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)
      await writeUserConfig(ctx.userDataDir, { folders: [folder.path!] })

      r = await callTool(ctx.url, 'get-media-folders')
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.folders).toEqual([folder.path!])
    } finally {
      await media.cleanup()
    }
  })
})
```

`is-folder-exist.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, folder1 } from './lib/testSetup'

describe('MCP Other - IsFolderExistTool', () => {
  const ctx = useMcpServer()

  test('should return exists=false then exists=true', async () => {
    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)

      const inexistentPath = join(media.mediaDir, `smm-mcp-inexistent-${Date.now()}`)
      let r = await callTool(ctx.url, 'is-folder-exist', { path: inexistentPath })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(false)
      expect(r.structuredContent!.path).toBe(inexistentPath)

      r = await callTool(ctx.url, 'is-folder-exist', { path: folder.path! })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(true)
      expect(r.structuredContent!.path).toBe(folder.path!)
    } finally {
      await media.cleanup()
    }
  })
})
```

`list-files.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, folder1 } from './lib/testSetup'

describe('MCP Other - ListFilesTool', () => {
  const ctx = useMcpServer()

  test('should list files from target folder', async () => {
    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)

      const r = await callTool(ctx.url, 'list-files', {
        folderPath: folder.path!,
        recursive: false,
        filter: undefined,
        videoFileOnly: false,
      })
      expect(r.isError).toBe(false)

      const expectedFilePaths = folder1.files.map((file) => join(folder.path!, file))
      expect(r.structuredContent!.files).toHaveLength(expectedFilePaths.length)
      expect([...r.structuredContent!.files as string[]].sort()).toEqual([...expectedFilePaths].sort())
    } finally {
      await media.cleanup()
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/get-app-context.test.ts ./mcp/get-media-folders.test.ts ./mcp/is-folder-exist.test.ts ./mcp/list-files.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/get-app-context.test.ts apps/e2e/mcp/get-media-folders.test.ts apps/e2e/mcp/is-folder-exist.test.ts apps/e2e/mcp/list-files.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP FS and app-context tool e2e tests

EOF
)"
```

---

### Task 5: Port metadata / episode tools

**Files:**
- Create: `apps/e2e/mcp/get-media-metadata.test.ts`
- Create: `apps/e2e/mcp/get-episode.test.ts`
- Create: `apps/e2e/mcp/get-episodes.test.ts`

**Interfaces:**
- Consumes: `seedRecognizedTvShowFolder`, `folder1`, `callTool`, `useMcpServer`

- [ ] **Step 1: Write the three test files**

`get-media-metadata.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { folder1, seedRecognizedTvShowFolder } from './lib/testSetup'

describe('MCP Other - GetMediaMetadataTool', () => {
  const ctx = useMcpServer()

  test('should return cached metadata for folder', async () => {
    const seeded = await seedRecognizedTvShowFolder(ctx, { ...folder1 }, (mm) => {
      if (mm.tvShow) {
        mm.tvShow.name = folder1.mediaName!
      }
      return mm
    })
    try {
      const r = await callTool(ctx.url, 'get-media-metadata', {
        mediaFolderPath: seeded.path,
      })
      expect(r.isError).toBe(false)
      const json = JSON.stringify(r.structuredContent)
      expect(json).toContain(folder1.mediaName!)
    } finally {
      await seeded.cleanup()
    }
  })
})
```

`get-episode.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { folder1, seedRecognizedTvShowFolder } from './lib/testSetup'

describe('MCP Other - GetEpisodeTool', () => {
  const ctx = useMcpServer()

  test('should return mapped video file path', async () => {
    const seeded = await seedRecognizedTvShowFolder(ctx, { ...folder1 })
    try {
      const r = await callTool(ctx.url, 'get-episode', {
        mediaFolderPath: seeded.path,
        season: 1,
        episode: 1,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.message).toBe('succeeded')
      expect(sc.season).toBe(1)
      expect(sc.episode).toBe(1)
      expect(sc.videoFilePath).toContain('S01E01.mkv')
    } finally {
      await seeded.cleanup()
    }
  })
})
```

`get-episodes.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { folder1, seedRecognizedTvShowFolder } from './lib/testSetup'

describe('MCP Other - GetEpisodesTool', () => {
  const ctx = useMcpServer()

  test('should return episodes list with mapped video path', async () => {
    const seeded = await seedRecognizedTvShowFolder(ctx, { ...folder1 })
    try {
      const r = await callTool(ctx.url, 'get-episodes', {
        mediaFolderPath: seeded.path,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.totalCount).toEqual(13)
      expect(sc.showName).toBeTruthy()
      expect(sc.numberOfSeasons).toEqual(2)
    } finally {
      await seeded.cleanup()
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/get-media-metadata.test.ts ./mcp/get-episode.test.ts ./mcp/get-episodes.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/get-media-metadata.test.ts apps/e2e/mcp/get-episode.test.ts apps/e2e/mcp/get-episodes.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP metadata and episode tool e2e tests

EOF
)"
```

---

### Task 6: Port `rename-folder`

**Files:**
- Create: `apps/e2e/mcp/rename-folder.test.ts`

**Interfaces:**
- Consumes: `callTool`, `useMcpServer`, `setupTestMediaFolders`, `writeUserConfig`, `seedMediaMetadata`, `metadataCacheFilePath`, `folder1`, `folder2`

- [ ] **Step 1: Write `rename-folder.test.ts`**

Port `test/mcp/rename-folder.test.ts` to Vitest (`it` → `test`, `bun:test` → `vitest`). Keep both TV Show and Movie cases and the local `seedRecognizedFolder` / `readMetadataCache` helpers inside the file (or move seed helper to `testSetup` if cleaner — either is fine as long as assertions match).

Source of truth for assertions: `test/mcp/rename-folder.test.ts` lines 60–121.

- [ ] **Step 2: Run test**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/rename-folder.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/rename-folder.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP rename-folder tool e2e test

EOF
)"
```

---

### Task 7: Port `scrape` and `get-job` (split files)

**Files:**
- Create: `apps/e2e/mcp/scrape.test.ts`
- Create: `apps/e2e/mcp/get-job.test.ts`

**Interfaces:**
- Consumes: `callTool`, `useMcpServer`, `setupTestMediaFolders`, `writeUserConfig`, `seedMediaMetadata`, `folder2`, `SCRAPE_JOB_CREATED_MESSAGE` from `@smm/types/ai-tools/scrape`

- [ ] **Step 1: Write `scrape.test.ts`**

Port the scrape half of `test/mcp/scrape.test.ts`: create movie fixture, call `scrape`, assert `id` / `message === SCRAPE_JOB_CREATED_MESSAGE` / no `error`. Use `test` + Vitest; timeout `150_000` via Vitest third arg or `test(..., { timeout: 150_000 })`.

Do **not** assert `get-job` terminal status in this file (that belongs in `get-job.test.ts`). Optionally still poll once only if needed to ensure job id is valid — prefer leaving polling to `get-job.test.ts`.

- [ ] **Step 2: Write `get-job.test.ts`**

Use the same movie scrape fixture setup as setup, then poll `get-job` until `succeeded`/`failed` (deadline 90s), assert the same terminal job shape as `test/mcp/scrape.test.ts` (kind, tasks.poster/fanart/thumbnails/nfo). Timeout `150_000`.

- [ ] **Step 3: Run tests**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/scrape.test.ts ./mcp/get-job.test.ts
```

Expected: PASS (needs TMDB network/env like the old suite).

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/mcp/scrape.test.ts apps/e2e/mcp/get-job.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP scrape and get-job tool e2e tests

EOF
)"
```

---

### Task 8: Port TMDB tools (split + helpers)

**Files:**
- Create: `apps/e2e/mcp/lib/tmdbTestHelpers.ts`
- Create: `apps/e2e/mcp/tmdb-search.test.ts`
- Create: `apps/e2e/mcp/tmdb-get-movie.test.ts`
- Create: `apps/e2e/mcp/tmdb-get-tv-show.test.ts`

**Interfaces:**
- Produces:
  - `export function applyTmdbUserConfig(): Partial<UserConfig>`
  - `export async function callTmdbTool(url: string, toolName: string, args: Record<string, unknown>, maxAttempts?: number): Promise<McpCallResult>`
  - Constants: `TV_SEARCH_KEYWORD`, `TV_TMDB_ID`, `MOVIE_TMDB_ID`, `TV_TITLE_PATTERN` (same values as `test/mcp/tmdb-tools.test.ts`)

- [ ] **Step 1: Create `tmdbTestHelpers.ts`**

Lift `callTmdbTool`, `applyTmdbUserConfig`, and the four constants from `test/mcp/tmdb-tools.test.ts`. Import `callTool` / `McpCallResult` from `./mcpInspectorClient`.

- [ ] **Step 2: Write three per-tool test files**

Each file: `useMcpServer`, `writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())`, then the matching assertion from `test/mcp/tmdb-tools.test.ts` with timeout `180_000`.

- [ ] **Step 3: Run tests**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/tmdb-search.test.ts ./mcp/tmdb-get-movie.test.ts ./mcp/tmdb-get-tv-show.test.ts
```

Expected: PASS when `TMDB_HOST` / `TMDB_API_KEY` (and optional http(s) `TMDB_HTTP_PROXY`) are available from `.env.local` / CI secrets.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/mcp/lib/tmdbTestHelpers.ts apps/e2e/mcp/tmdb-search.test.ts apps/e2e/mcp/tmdb-get-movie.test.ts apps/e2e/mcp/tmdb-get-tv-show.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP TMDB tool e2e tests into per-tool files

EOF
)"
```

---

### Task 9: Port start/stop lifecycle test (built binary)

**Files:**
- Create: `apps/e2e/mcp/start-stop-mcp-server-in-cli.test.ts`
- May export from `apps/e2e/mcp/lib/mcpServer.ts`: `findFreePort`, `cliBinaryPath`, `repoRoot` (already exported)

**Interfaces:**
- Spawn **built binary** (`cliBinaryPath()`), not `apps/cli/index.ts`.
- Capture stdout for `MCP server started at` assertions (custom spawn in the test file is OK; do not break `startMcpServer` for other tests).
- Keep Windows skip for SIGINT graceful-stop case (`test.skipIf(process.platform === 'win32')` in Vitest).

- [ ] **Step 1: Port test to Vitest + binary spawn**

Adapt `test/mcp/start-stop-mcp-server-in-cli.test.ts`:
- `bun:test` → `vitest` (`it` → `test`, `it.skipIf` → `test.skipIf`)
- Replace `spawn(process.execPath, [cliEntry, ...])` with `spawn(cliBinaryPath(), ['mcp', 'start', ...])` and `chmod` on non-Windows like `mcpServer.ts`
- Keep the three cases: startup message + `enableMcpServer`, custom host/port persistence, SIGINT clears flag (Unix only)

- [ ] **Step 2: Run test**

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/start-stop-mcp-server-in-cli.test.ts
```

Expected: PASS (SIGINT case skipped on Windows)

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/mcp/start-stop-mcp-server-in-cli.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): port MCP CLI start/stop lifecycle e2e to built binary

EOF
)"
```

---

### Task 10: Scripts, docs, knip; delete `test/mcp/`

**Files:**
- Modify: `package.json` (`e2e:mcp`)
- Modify: `knip.json`
- Modify: `apps/e2e/mcp/README.md`
- Delete: entire `test/mcp/` directory

- [ ] **Step 1: Update root `package.json`**

Change:

```json
"e2e:mcp": "bun ci/run-mcp-e2e-test.ts",
```

Keep `"e2e:mcp:bin": "bun ci/run-mcp-e2e-test.ts"` (or make it an alias — both may point to the same command).

- [ ] **Step 2: Update `knip.json`**

Remove `"test/mcp/**/*.test.ts"` from root `entry` and remove `"test/mcp/lib/**"` from `ignore`. Keep `test/mcp-test-client/*.ts`.

- [ ] **Step 3: Rewrite `apps/e2e/mcp/README.md`**

Document:
- Purpose (MCP server e2e via Inspector, no UI)
- Prerequisite: `pnpm --filter cli run build`
- Run: `bun ci/run-mcp-e2e-test.ts` or `pnpm e2e:mcp`
- Single file: `bun ci/run-mcp-e2e-test.ts ./mcp/<file>.test.ts`
- Table of test files ↔ tools (include tools/list + start-stop)
- Note TMDB env for scrape/get-job/tmdb-*
- Note out-of-scope tools for a follow-up

- [ ] **Step 4: Full suite green**

```bash
pnpm --filter cli run build
bun ci/run-mcp-e2e-test.ts
```

Expected: all ported tests PASS.

- [ ] **Step 5: Delete `test/mcp/`**

```bash
rm -rf test/mcp
```

Confirm no remaining references that would break CI (grep `bun test test/mcp` / `test/mcp/`). Update any docs that still say to run `bun test test/mcp/` to point at `apps/e2e/mcp` / `pnpm e2e:mcp`. Do **not** delete `test/mcp-test-client/`.

- [ ] **Step 6: Commit**

```bash
git add package.json knip.json apps/e2e/mcp/README.md
git add -u test/mcp
git commit -m "$(cat <<'EOF'
refactor(e2e): retire test/mcp in favor of apps/e2e/mcp Vitest suite

EOF
)"
```

---

## Self-Review

1. **Spec coverage:** Layout (§1), runtime/CI (§2), migration/delete (§3) each map to Tasks 1–10. Out-of-scope tools explicitly omitted.
2. **Placeholders:** None — ports cite source files and include full code for helpers and simpler tests; scrape/rename/tmdb/start-stop instruct “port from `test/mcp/...` with Vitest conversion” with concrete assertion/source line anchors.
3. **Type consistency:** `callTool` / `McpCallResult` / `seedRecognizedTvShowFolder` / `applyTmdbUserConfig` / `callTmdbTool` names match across tasks.
