# Split packages/core into @smm/types, @smm/utils, @smm/core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut `packages/core` into `@smm/types` (schemas), `@smm/utils` (pure tools), and `@smm/core` (`apps/core` business logic), then delete the old package.

**Architecture:** Create `packages/types` and expand `packages/utils` by copying/moving files from `packages/core`; move business modules into `apps/core` and rename that package to `@smm/core`; update all imports, aliases, Docker, and docs; delete `packages/core`. UI and CLI import `@smm/core` directly.

**Tech Stack:** pnpm workspaces, TypeScript path aliases / package exports, Vitest, Vite (UI), Bun (CLI)

**Spec:** [docs/superpowers/specs/2026-08-31-packages-core-split-design.md](../specs/2026-08-31-packages-core-split-design.md)

## Global Constraints

- `@smm/types` = types / interface / Zod / schema constants only; no business orchestration.
- `@smm/utils` = domain-agnostic (or Path/locale/fetch) pure tools; may depend on `@smm/types`; must not depend on `@smm/core`.
- Business logic (ai-tool, validations, whitelistedCmd, plan, download-video-*, mediaMetadata helpers, userConfig helpers, getMediaFolder, configMigration) lives in `apps/core` as `@smm/core`.
- Hard cutover: no compatibility re-exports from deleted `packages/core`; no `@core/*` alias retained.
- `apps/ui` and `apps/cli` may `import` from `@smm/core` directly.
- Do not refactor `packages/core-routes` business ownership; only update imports/deps.
- Do not change HTTP API contracts.
- Intermediate commits may fail full-monorepo `typecheck` until Task 5 (consumer cutover) completes; each new package must self-typecheck/self-test as soon as it exists.

## File Structure (target)

```
packages/types/                    # @smm/types
  package.json
  tsconfig.json
  vitest.config.ts
  types.ts                         # from packages/core/types.ts → "@smm/types"
  ai-tools/*                       # from packages/core/types/ai-tools/* → "@smm/types/ai-tools/..."
  RenameFilesPlan.ts               # (+ RecognizeMediaFilePlan, planCommon, YtdlpTypes, GetEpisodesToolTypes)
  event-types.ts
  errorCodes.ts                    # string constants only (from errors.ts)
  job/ImportLibraryJob.ts
  tmdbPrimaryTranslations.ts
  tvdbSupportedLanguages.ts (+ test)
  mediaFileExtensions.ts           # extensions + getFullExtensionForAssociatedFile (from utils.ts)
  validations/rename/types.ts

packages/utils/                    # @smm/utils (expanded)
  src/index.ts                     # existing formatDate/debounce/...
  src/path.ts (+ tests)
  src/uri.ts / url.ts (+ tests)
  src/locale.ts (+ test)
  src/versionCompare.ts (+ test)
  src/proxiableFetch.ts (+ test)
  src/errors.ts                    # isError, existedFileError, fileNotFoundError, noThrow

apps/core/                         # package name @smm/core
  src/…                            # existing Core/pipeline/ports
  src/ai-tool/**
  src/validations/rename/**        # implementations; types imported from @smm/types
  src/whitelistedCmd/**
  src/plan/renamePlan.ts
  src/getMediaFolder.ts
  src/configMigration.ts
  src/download-video-*.ts
  src/mediaMetadata.ts
  src/userConfig.ts
```

---

### Task 1: Create `@smm/types` package

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/vitest.config.ts`
- Create: files listed under `packages/types/` in File Structure (copy from `packages/core`, then fix relative imports)
- Modify: none of consumers yet

**Interfaces:**
- Consumes: nothing from workspace
- Produces: package `@smm/types` with subpath exports for every top-level and nested module consumers currently import under types/schema paths

- [ ] **Step 1: Scaffold package.json**

Create `packages/types/package.json`:

```json
{
  "name": "@smm/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./types.ts",
    "./*": "./*"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "zod": "^4.1.8"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Copy type/schema files (flatten so `@smm/types/ai-tools/X` matches old `@smm/core/types/ai-tools/X`)**

From repo root (Git Bash / bash):

```bash
mkdir -p packages/types/ai-tools packages/types/job packages/types/validations/rename
cp packages/core/types.ts packages/types/types.ts
cp -r packages/core/types/ai-tools/* packages/types/ai-tools/
cp packages/core/types/RenameFilesPlan.ts packages/types/RenameFilesPlan.ts
cp packages/core/types/RecognizeMediaFilePlan.ts packages/types/RecognizeMediaFilePlan.ts
cp packages/core/types/planCommon.ts packages/types/planCommon.ts
cp packages/core/types/YtdlpTypes.ts packages/types/YtdlpTypes.ts
cp packages/core/types/GetEpisodesToolTypes.ts packages/types/GetEpisodesToolTypes.ts
cp packages/core/event-types.ts packages/types/event-types.ts
cp packages/core/job/ImportLibraryJob.ts packages/types/job/ImportLibraryJob.ts
cp packages/core/tmdbPrimaryTranslations.ts packages/types/tmdbPrimaryTranslations.ts
cp packages/core/tvdbSupportedLanguages.ts packages/types/tvdbSupportedLanguages.ts
cp packages/core/tvdbSupportedLanguages.test.ts packages/types/tvdbSupportedLanguages.test.ts
cp packages/core/validations/rename/types.ts packages/types/validations/rename/types.ts
cp packages/core/utils.ts packages/types/mediaFileExtensions.ts
```

Fix relative imports that previously used `./planCommon` / `./ai-tools/...` inside the flattened files (they stay relative under `packages/types/`).

Create `packages/types/errorCodes.ts` with only the string constants from `packages/core/errors.ts`:

```ts
export const ExistedFileError = 'File Already Existed';
export const FileNotFoundError = 'File Not Found';
```

- [ ] **Step 3: Fix internal imports inside packages/types**

In `packages/types/event-types.ts`, keep `import type { UserConfig } from "./types"`.

In `packages/types/mediaFileExtensions.ts`, keep content of old `utils.ts` unchanged (no Path import).

Copy `packages/core/tsconfig.json` shape into `packages/types/tsconfig.json`, but set paths only if needed for self-imports; prefer relative imports. Minimal:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": "."
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `packages/types/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Install and verify package alone**

```bash
pnpm install
pnpm --filter @smm/types typecheck
pnpm --filter @smm/types test
```

Expected: typecheck clean; `tvdbSupportedLanguages` test PASS (and any other tests copied).

- [ ] **Step 5: Commit**

```bash
git add packages/types
git commit -m "$(cat <<'EOF'
feat(types): add @smm/types package with schemas from packages/core

EOF
)"
```

---

### Task 2: Expand `@smm/utils` with Path / locale / fetch tools

**Files:**
- Modify: `packages/utils/package.json`
- Modify: `packages/utils/tsconfig.json` (include tests / new src files)
- Create: `packages/utils/src/path.ts`, `uri.ts`, `url.ts`, `locale.ts`, `versionCompare.ts`, `proxiableFetch.ts`, `errors.ts` (+ matching `*.test.ts`)
- Create: `packages/utils/vitest.config.ts`

**Interfaces:**
- Consumes: `@smm/types` (locale needs `LanguageCode`, `PreferMediaLanguage`, `TMDB_PRIMARY_TRANSLATIONS`)
- Produces: `@smm/utils/path`, `@smm/utils/locale`, `@smm/utils/uri`, `@smm/utils/url`, `@smm/utils/versionCompare`, `@smm/utils/proxiableFetch`, `@smm/utils/errors`

- [ ] **Step 1: Update package.json exports and deps**

Replace `packages/utils/package.json` with:

```json
{
  "name": "@smm/utils",
  "version": "1.2.19",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./path": "./src/path.ts",
    "./uri": "./src/uri.ts",
    "./url": "./src/url.ts",
    "./locale": "./src/locale.ts",
    "./versionCompare": "./src/versionCompare.ts",
    "./proxiableFetch": "./src/proxiableFetch.ts",
    "./errors": "./src/errors.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@smm/types": "workspace:*",
    "es-toolkit": "^1.42.0",
    "filenamify": "^7.0.1",
    "slash": "^5.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Copy utility source + tests**

```bash
cp packages/core/path.ts packages/utils/src/path.ts
cp packages/core/path.test.ts packages/utils/src/path.test.ts
cp packages/core/path.server-platform.test.ts packages/utils/src/path.server-platform.test.ts
cp packages/core/uri.ts packages/utils/src/uri.ts
cp packages/core/uri.test.ts packages/utils/src/uri.test.ts
cp packages/core/url.ts packages/utils/src/url.ts
cp packages/core/url.test.ts packages/utils/src/url.test.ts
cp packages/core/locale.ts packages/utils/src/locale.ts
cp packages/core/locale.test.ts packages/utils/src/locale.test.ts
cp packages/core/versionCompare.ts packages/utils/src/versionCompare.ts
cp packages/core/versionCompare.test.ts packages/utils/src/versionCompare.test.ts
cp packages/core/proxiableFetch.ts packages/utils/src/proxiableFetch.ts
cp packages/core/proxiableFetch.test.ts packages/utils/src/proxiableFetch.test.ts
```

Create `packages/utils/src/errors.ts`:

```ts
import {
  ExistedFileError,
  FileNotFoundError,
} from '@smm/types/errorCodes'

export { ExistedFileError, FileNotFoundError }

export function isError(error: string, message: string) {
  return error.startsWith(`${message}:`)
}

export function existedFileError(path: string): string {
  return `${ExistedFileError}: ${path}`
}

export function fileNotFoundError(path: string): string {
  return `${FileNotFoundError}: ${path}`
}

export function noThrow<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  ...args: Args
): void {
  if (typeof fn !== 'function') {
    return
  }
  try {
    void Promise.resolve(fn(...args)).catch(() => {})
  } catch {
    /* sync throw */
  }
}
```

- [ ] **Step 3: Fix locale imports to @smm/types**

In `packages/utils/src/locale.ts` replace:

```ts
import type { LanguageCode, PreferMediaLanguage } from './types'
import { TMDB_PRIMARY_TRANSLATIONS } from './tmdbPrimaryTranslations'
```

with:

```ts
import type { LanguageCode, PreferMediaLanguage } from '@smm/types'
import { TMDB_PRIMARY_TRANSLATIONS } from '@smm/types/tmdbPrimaryTranslations'
```

Fix any relative imports inside copied tests the same way. Keep `path.ts` / `uri` / `url` / `versionCompare` / `proxiableFetch` free of `@smm/core` imports.

- [ ] **Step 4: Vitest + tsconfig**

`packages/utils/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

Ensure `packages/utils/tsconfig.json` `"include": ["src"]`.

- [ ] **Step 5: Verify**

```bash
pnpm install
pnpm --filter @smm/utils typecheck
pnpm --filter @smm/utils test
```

Expected: PASS (path/locale/url/uri/versionCompare/proxiableFetch tests).

- [ ] **Step 6: Commit**

```bash
git add packages/utils
git commit -m "$(cat <<'EOF'
feat(utils): move Path, locale, and fetch helpers into @smm/utils

EOF
)"
```

---

### Task 3: Move business modules into `apps/core` and rename package to `@smm/core`

**Files:**
- Modify: `apps/core/package.json` (`name`: `@smm/core`; deps: `@smm/types`, `@smm/utils`; remove old `@smm/core` → types)
- Create under `apps/core/src/`: `ai-tool/**`, `validations/rename/**`, `whitelistedCmd/**`, `plan/**`, `getMediaFolder.ts`, `configMigration.ts`, `download-video-*.ts`, `mediaMetadata.ts`, `userConfig.ts` (+ tests)
- Modify: `apps/core` exports map for subpaths
- Modify: moved files’ imports (`../path` → `@smm/utils/path`, `../types` → `@smm/types`, etc.)

**Interfaces:**
- Consumes: `@smm/types`, `@smm/utils`
- Produces: `@smm/core` (root + subpaths such as `@smm/core/ai-tool/toolResult`, `@smm/core/validations/rename/validateRenameOperations`, `@smm/core/whitelistedCmd/...`)

- [ ] **Step 1: Copy business trees into apps/core/src**

```bash
cp -r packages/core/ai-tool apps/core/src/ai-tool
mkdir -p apps/core/src/validations/rename apps/core/src/plan
cp packages/core/validations/rename/*.ts apps/core/src/validations/rename/
rm -f apps/core/src/validations/rename/types.ts
cp -r packages/core/whitelistedCmd apps/core/src/whitelistedCmd
cp packages/core/plan/renamePlan.ts apps/core/src/plan/renamePlan.ts
cp packages/core/plan/renamePlan.test.ts apps/core/src/plan/renamePlan.test.ts
cp packages/core/getMediaFolder.ts apps/core/src/getMediaFolder.ts
cp packages/core/configMigration.ts apps/core/src/configMigration.ts
cp packages/core/download-video-validators.ts apps/core/src/download-video-validators.ts
cp packages/core/download-video-validators.test.ts apps/core/src/download-video-validators.test.ts
cp packages/core/download-video-cookie-platform.ts apps/core/src/download-video-cookie-platform.ts
cp packages/core/download-video-cookie-platform.test.ts apps/core/src/download-video-cookie-platform.test.ts
cp packages/core/mediaMetadata.ts apps/core/src/mediaMetadata.ts
cp packages/core/mediaMetadata.test.ts apps/core/src/mediaMetadata.test.ts
cp packages/core/userConfig.ts apps/core/src/userConfig.ts
cp packages/core/userConfig.test.ts apps/core/src/userConfig.test.ts
```

- [ ] **Step 2: Rewrite imports inside moved modules**

Apply these replacements under `apps/core/src/{ai-tool,validations,whitelistedCmd,plan}` and the root moved files:

| Old pattern | New |
|-------------|-----|
| `from '../path'` / `from '../../path'` / `from "./path"` | `from '@smm/utils/path'` |
| `from '../utils'` / `from "../../utils"` | `from '@smm/types/mediaFileExtensions'` |
| `from '../types'` / `from '../../types'` / `from "./types"` (MediaMetadata/UserConfig) | `from '@smm/types'` |
| `from '../types/ai-tools/...'` | `from '@smm/types/ai-tools/...'` |
| `from './types'` in validations (RenameOperation) | `from '@smm/types/validations/rename/types'` |
| `from "./path"` in mediaMetadata/userConfig | `from '@smm/utils/path'` |

- [ ] **Step 3: Update apps/core/package.json**

```json
{
  "name": "@smm/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./createRenameEpisodePlan": "./src/pipeline/createRenameEpisodePlan.ts",
    "./FsPort": "./src/ports/FsPort.ts",
    "./ai-tool/*": "./src/ai-tool/*",
    "./validations/rename/*": "./src/validations/rename/*",
    "./whitelistedCmd": "./src/whitelistedCmd/index.ts",
    "./whitelistedCmd/*": "./src/whitelistedCmd/*",
    "./plan/*": "./src/plan/*",
    "./getMediaFolder": "./src/getMediaFolder.ts",
    "./configMigration": "./src/configMigration.ts",
    "./download-video-validators": "./src/download-video-validators.ts",
    "./download-video-cookie-platform": "./src/download-video-cookie-platform.ts",
    "./mediaMetadata": "./src/mediaMetadata.ts",
    "./userConfig": "./src/userConfig.ts",
    "./*": "./src/*"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@smm/types": "workspace:*",
    "@smm/utils": "workspace:*",
    "@smm/tvdb4": "workspace:*",
    "es-toolkit": "^1.42.0"
  },
  "devDependencies": {
    "@smm/test": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 4: Fix existing apps/core source imports**

Replace across `apps/core/src/**` (except newly copied trees already fixed):

| Old | New |
|-----|-----|
| `from "@smm/core"` / `from "@smm/core/types"` / `from "@core/types"` | `from "@smm/types"` |
| `from "@core/path"` / `from "@smm/core/path"` | `from "@smm/utils/path"` |
| `from "@core/utils"` | `from "@smm/types/mediaFileExtensions"` |
| `from "@smm/core/job/ImportLibraryJob"` | `from "@smm/types/job/ImportLibraryJob"` |
| `from "@smm/core/plan/renamePlan"` | `from "@smm/core/plan/renamePlan"` (self — use relative `./plan/renamePlan` or package subpath) |
| `from "@smm/core/validations/..."` | relative under `src/validations/...` or `@smm/core/validations/...` |

Update `apps/core/tsconfig.json` paths: remove `@core/*` and old `@smm/core` → `packages/core` mappings. Prefer package resolution via workspace.

Update `apps/core/vitest.config.ts`: remove `packages/core` alias; alias `@smm/types` / `@smm/utils` if Vitest needs explicit resolve.

- [ ] **Step 5: validations index re-exports types from @smm/types**

In `apps/core/src/validations/rename/index.ts`:

```ts
export type { RenameOperation } from '@smm/types/validations/rename/types'
// ... keep exporting implementation functions from local files
```

- [ ] **Step 6: Verify apps/core**

```bash
pnpm install
pnpm --filter @smm/core typecheck
pnpm --filter @smm/core test
```

Expected: PASS. If `@smm/test` still depends on old `@smm/core` (packages/core), temporarily point `@smm/test` deps to `@smm/types` + `@smm/utils` in this task or Task 4 before running tests that pull `@smm/test`.

- [ ] **Step 7: Commit**

```bash
git add apps/core packages/types packages/utils
git commit -m "$(cat <<'EOF'
feat(core): rename core-app to @smm/core and absorb business modules

EOF
)"
```

---

### Task 4: Retarget workspace package.json dependencies and root scripts

**Files:**
- Modify: `package.json` (root scripts `typecheck:core`, `test:core`, `build:core`, `typecheck:core-app`, `test:core-app`)
- Modify: `apps/ui/package.json`, `apps/cli/package.json`, `apps/e2e/package.json`
- Modify: `packages/core-routes/package.json`, `packages/test/package.json`
- Modify: any other `package.json` still listing `core-app` or old `@smm/core`

**Interfaces:**
- Consumes: Task 1–3 packages
- Produces: correct workspace dependency graph

- [ ] **Step 1: Update consumer dependencies**

For each consumer:

**apps/ui** — replace `"@smm/core": "workspace:*"` with:

```json
"@smm/types": "workspace:*",
"@smm/utils": "workspace:*",
"@smm/core": "workspace:*"
```

**apps/cli** — replace `"core-app": "workspace:*"` with `"@smm/core": "workspace:*"`; add `@smm/types` and `@smm/utils` if not transitive-only (prefer direct deps for anything imported).

**packages/core-routes** — replace:

```json
"@smm/core": "workspace:*",
"core-app": "workspace:*"
```

with:

```json
"@smm/types": "workspace:*",
"@smm/utils": "workspace:*",
"@smm/core": "workspace:*"
```

**packages/test** / **apps/e2e**: same split — types/utils/core as needed.

- [ ] **Step 2: Update root package.json scripts**

Replace:

```json
"build:core": "cd packages/core && pnpm run typecheck",
"test:core": "cd packages/core && pnpm test",
"typecheck:core": "cd packages/core && pnpm run typecheck",
"typecheck:core-app": "cd apps/core && pnpm run typecheck",
"test:core-app": "cd apps/core && pnpm test",
```

with:

```json
"build:types": "cd packages/types && pnpm run typecheck",
"test:types": "cd packages/types && pnpm test",
"typecheck:types": "cd packages/types && pnpm run typecheck",
"build:utils": "cd packages/utils && pnpm run typecheck",
"test:utils": "cd packages/utils && pnpm test",
"typecheck:utils": "cd packages/utils && pnpm run typecheck",
"typecheck:core": "cd apps/core && pnpm run typecheck",
"test:core": "cd apps/core && pnpm test",
```

Update aggregate `typecheck` / `build:electron` scripts to call `typecheck:types`, `typecheck:utils`, `typecheck:core` instead of `packages/core` / `typecheck:core-app`.

- [ ] **Step 3: pnpm install**

```bash
pnpm install
```

Expected: lockfile updates; no unresolved `core-app`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml apps/*/package.json packages/*/package.json
git commit -m "$(cat <<'EOF'
chore: retarget workspace deps from packages/core to types/utils/@smm/core

EOF
)"
```

---

### Task 5: Codemod all imports and remove path aliases

**Files:**
- Modify: all TS/TSX under `apps/ui`, `apps/cli`, `apps/core`, `apps/e2e`, `apps/electron`, `apps/ohos`, `packages/core-routes`, `packages/test`, `test/mcp`
- Modify: `apps/ui/vite.config.ts`, `apps/ui/vitest.config.ts`, `apps/ui/tsconfig.json`, `apps/ui/tsconfig.app.json`
- Modify: `apps/cli/tsconfig.json`, `apps/cli/vitest.config.ts`
- Modify: `apps/core/tsconfig.json`, `apps/core/vitest.config.ts`
- Modify: `apps/e2e/tsconfig.json`, `apps/electron/tsconfig.json`, `apps/ohos/tsconfig.json`, `test/mcp/tsconfig.json`

**Interfaces:**
- Consumes: import mapping table below
- Produces: zero `@core/` and zero `core-app` imports; zero `@smm/core` imports that mean old types package

- [ ] **Step 1: Apply mechanical import replacements**

From repo root, use a careful search-replace (manual review of edge cases). Mapping:

| Old import prefix | New |
|-------------------|-----|
| `@core/types` / `@smm/core/types` / bare `@smm/core` when importing DTOs from types.ts | `@smm/types` |
| `@core/types/...` / `@smm/core/types/...` | `@smm/types/...` (e.g. `@smm/types/RenameFilesPlan`, `@smm/types/ai-tools/scrape`) |
| `@core/path` / `@smm/core/path` | `@smm/utils/path` |
| `@core/uri` / `@core/url` / `@core/locale` / `@core/versionCompare` / `@core/proxiableFetch` | `@smm/utils/<same>` |
| `@core/errors` / `@smm/core/errors` | `@smm/utils/errors` (or split: codes from `@smm/types/errorCodes`) |
| `@core/utils` / `@smm/core/utils` | `@smm/types/mediaFileExtensions` |
| `@core/event-types` / `@smm/core/event-types` | `@smm/types/event-types` |
| `@core/job/...` / `@smm/core/job/...` | `@smm/types/job/...` |
| `@core/tmdbPrimaryTranslations` / `tvdbSupportedLanguages` | `@smm/types/...` |
| `@core/ai-tool/...` / `@smm/core/ai-tool/...` | `@smm/core/ai-tool/...` (apps/core) |
| `@core/validations/...` / `@smm/core/validations/...` | `@smm/core/validations/...` |
| `@core/whitelistedCmd...` | `@smm/core/whitelistedCmd...` |
| `@core/plan/...` | `@smm/core/plan/...` |
| `@core/download-video-...` / `getMediaFolder` / `configMigration` / `mediaMetadata` / `userConfig` | `@smm/core/...` |
| `from 'core-app'` / `from "core-app/..."` | `from '@smm/core'` / `from '@smm/core/...'` |

Special case: UI historically imported DTOs via `@smm/core` because tsconfig mapped `@smm/core` → `packages/core/types.ts`. After cutover, those become `@smm/types`. CLI `import type { MediaMetadata } from '@smm/core'` → `@smm/types`.

- [ ] **Step 2: Remove aliases**

Delete all `@core` / old `packages/core` path mappings from tsconfigs and Vite/Vitest configs listed above.

For UI Vite, remove:

```ts
"@core": path.resolve(__dirname, "../../packages/core"),
```

Rely on pnpm workspace package names. If Vitest cannot resolve workspace packages, add:

```ts
find: '@smm/types', replacement: path.resolve(__dirname, '../../packages/types')
// similarly for @smm/utils and @smm/core → apps/core
```

For CLI vitest, replace `core-app` aliases with `@smm/core` → `../core/src/...`.

- [ ] **Step 3: Spot-check remaining bad references**

```bash
rg -n "@core/|from ['\"]core-app|packages/core" --glob '!**/node_modules/**' --glob '!**/docs/**' --glob '!**/CHANGELOG.md' --glob '!**/report.md'
```

Expected: no hits in source/config (docs/plans may still mention history).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: cut over imports to @smm/types, @smm/utils, and @smm/core

EOF
)"
```

---

### Task 6: Delete `packages/core` and update Docker / AGENTS / overview

**Files:**
- Delete: entire `packages/core/`
- Modify: `apps/docker/cli.Dockerfile`, `apps/docker/ui.Dockerfile` (and any other Dockerfiles copying `packages/core`)
- Modify: `AGENTS.md`, `.cursorrules`, `docs/dev/overview.md`
- Modify: any CI scripts referencing `packages/core`

**Interfaces:**
- Consumes: cutover complete
- Produces: no `packages/core` on disk

- [ ] **Step 1: Update Docker COPY lines**

In `apps/docker/cli.Dockerfile` and `apps/docker/ui.Dockerfile`, replace:

```dockerfile
COPY packages/core packages/core
```

with:

```dockerfile
COPY packages/types packages/types
COPY packages/utils packages/utils
```

Ensure `apps/core` is still copied where CLI/UI build needs it (cli.Dockerfile already notes core-app — update comments to `@smm/core`).

- [ ] **Step 2: Delete old package**

```bash
rm -rf packages/core
pnpm install
```

- [ ] **Step 3: Update AGENTS.md package table**

Replace `packages/core` row with:

| **packages/types** | 跨端共享类型、interface、Zod schema |
| **packages/utils** | 无业务语义纯工具（Path、locale、uri/url 等） |

Update apps table / 核心模块详解: `apps/core` is `@smm/core` business Core.

Update Path guidance: use `@smm/utils/path`.

- [ ] **Step 4: Update .cursorrules Path line**

Change `core/path.ts` → `@smm/utils/path` (`packages/utils/src/path.ts`).

- [ ] **Step 5: Update docs/dev/overview.md**

Clarify Core node = `apps/core` / `@smm/core`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove packages/core and document types/utils/@smm/core split

EOF
)"
```

---

### Task 7: Full verification

**Files:** none (verification only); fix any failures in place

- [ ] **Step 1: Grep acceptance**

```bash
test ! -d packages/core
rg -n '"name": "core-app"|'"'"'core-app'"'"'|@core/' --glob '!**/node_modules/**' --glob '!**/docs/superpowers/**' --glob '!**/CHANGELOG.md' || true
```

Expected: no `packages/core` directory; no live `core-app` package name; no `@core/` aliases in app configs.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Unit tests for touched packages**

```bash
pnpm --filter @smm/types test
pnpm --filter @smm/utils test
pnpm --filter @smm/core test
pnpm --filter @smm/core-routes test
pnpm --filter ui test
pnpm --filter cli test
```

Expected: PASS (or pre-existing failures unrelated — if any fail due to this refactor, fix before claiming done).

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git status
# if dirty:
git commit -m "$(cat <<'EOF'
fix: resolve typecheck/test fallout from packages/core split

EOF
)"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| `@smm/types` for types/Zod/schema constants | Task 1 |
| `@smm/utils` for Path/locale/uri/url/versionCompare/proxiableFetch/error helpers | Task 2 |
| Business → `apps/core` as `@smm/core` | Task 3 |
| Hard cutover imports / no `@core` / delete `packages/core` | Tasks 5–6 |
| UI/CLI direct import of `@smm/core` | Tasks 4–5 |
| Update AGENTS/overview | Task 6 |
| typecheck + unit tests | Task 7 |
| No core-routes ownership refactor / no HTTP contract change | Global Constraints |

**Note on `mediaFileExtensions`:** old `utils.ts` includes `getFullExtensionForAssociatedFile`; it moves with extension constants into `@smm/types/mediaFileExtensions` (domain constants + tiny pure helper), not `@smm/utils`.
