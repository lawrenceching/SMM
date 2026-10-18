# FFmpeg Convert + VideoCaptioner Jobs E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default-CI CLI and Web UI end-to-end tests for `FfmpegConvertJob`, `TranscribeSubtitleJob`, `TranslateSubtitleJob`, `SynthesizeSubtitleJob`, and `ProcessSubtitleJob`.

**Architecture:** Two clusters mirror compress e2e: ffmpeg (`convert`) and videocaptioner (four jobs). Shared helpers prepare `sample.mp4`, write a minimal `.srt`, and detect VideoCaptioner under `bin/videocaptioner/`. Success = exit 0 / dialog OK + output `size > 0`. Missing binaries → skip; network ASR/Google failures → fail. Process uses `--no-translate --no-synthesize` (CLI) / check noTranslate (UI). Spec: [2026-10-19-ffmpeg-videocaptioner-e2e-design.md](../specs/2026-10-19-ffmpeg-videocaptioner-e2e-design.md). Prior art: `apps/e2e/cli/compress.test.ts`, `apps/e2e/common/ffmpeg/CompressVideo.e2e.ts`.

**Tech Stack:** Bun test (CLI e2e), WebdriverIO 9 (UI e2e), TypeScript, existing `prepareVideoFile` / `browser-fs` / Music panel COs.

## Global Constraints

- Default CI placement: specs under `apps/e2e/cli/` and `apps/e2e/common/{ffmpeg,videocaptioner}/` (not `common/manual/`).
- Skip when ffmpeg / VideoCaptioner binary missing; skip OHOS; Docker assumes ffmpeg available (`isDockerE2e || check…`).
- VC shortest paths: process `--no-translate --no-synthesize`; translate = inline srt + `google`; synthesize = video + inline srt; UI Confirm defaults only.
- Success = exit 0 (CLI) or dialog closes without error (UI) **and** expected artifact `size > 0`.
- Do not commit `sample.mp4`; reuse `prepareVideoFile`.
- Prefer copying CompressVideo patterns; extend MusicPanel CO rather than duplicating menu helpers.
- Optional production UI change: add `data-testid="process-pipeline-no-translate"` only if needed for Process e2e.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `apps/e2e/test/lib/prepareMinimalSrt.ts` | Write fixed minimal SRT |
| `apps/e2e/test/lib/checkVideoCaptionerAvailable.ts` | Detect `bin/videocaptioner/videocaptioner[.exe]` |
| `apps/e2e/test/lib/e2eOutputWait.ts` (optional) | Shared `waitForOutputFile` / list-diff helpers for UI |
| `apps/e2e/cli/convert.test.ts` | CLI convert |
| `apps/e2e/cli/transcribe.test.ts` | CLI transcribe |
| `apps/e2e/cli/translate.test.ts` | CLI translate |
| `apps/e2e/cli/synthesize.test.ts` | CLI synthesize |
| `apps/e2e/cli/process.test.ts` | CLI process short path |
| `apps/e2e/common/ffmpeg/ConvertVideo.e2e.ts` | UI convert (CI) |
| `apps/e2e/common/manual/ConvertVideoFormat.e2e.ts` | Delete or thin re-export so CI does not double-run |
| `apps/e2e/common/videocaptioner/Transcribe.e2e.ts` | UI transcribe |
| `apps/e2e/common/videocaptioner/Translate.e2e.ts` | UI translate |
| `apps/e2e/common/videocaptioner/Synthesize.e2e.ts` | UI synthesize |
| `apps/e2e/common/videocaptioner/Process.e2e.ts` | UI process short path |
| `apps/e2e/test/componentobjects/MusicPanel.co.ts` | Labels for translate / synthesize / process |
| `apps/ui/.../UIProcessPipelineDialog.tsx` | `data-testid` on noTranslate checkbox |
| `knip.json` | `ignoreBinaries` for `videocaptioner` if probed via exec |

---

### Task 1: Shared helpers — `prepareMinimalSrt` + VideoCaptioner discovery

**Files:**
- Create: `apps/e2e/test/lib/prepareMinimalSrt.ts`
- Create: `apps/e2e/test/lib/checkVideoCaptionerAvailable.ts`
- Modify: `apps/e2e/test/lib/testbed.ts` (re-export helpers used by Web specs, same pattern as `prepareVideoFile`)

**Interfaces:**
- Produces: `prepareMinimalSrt(filepath: string): void`
- Produces: `checkVideoCaptionerAvailable(): boolean`
- Produces: `VIDEOCAPTIONER_EXE_PATH` (absolute path string for debugging)

- [ ] **Step 1: Add `prepareMinimalSrt.ts`**

```ts
import * as fs from 'node:fs'
import * as path from 'node:path'

/** Minimal bilingual-friendly SRT for translate/synthesize e2e (no network). */
export const MINIMAL_SRT_BODY = `1
00:00:00,000 --> 00:00:02,000
Hello world

2
00:00:02,000 --> 00:00:04,000
This is a test subtitle
`

export function prepareMinimalSrt(filepath: string): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, MINIMAL_SRT_BODY, 'utf8')
}
```

- [ ] **Step 2: Add `checkVideoCaptionerAvailable.ts`**

```ts
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')

export const VIDEOCAPTIONER_EXE_NAME =
  process.platform === 'win32' ? 'videocaptioner.exe' : 'videocaptioner'

export const VIDEOCAPTIONER_EXE_PATH = path.join(
  REPO_ROOT,
  'bin',
  'videocaptioner',
  VIDEOCAPTIONER_EXE_NAME,
)

/** True when CI/local `bin/videocaptioner` layout from `ci/download-3pp-binary.sh` is present. */
export function checkVideoCaptionerAvailable(): boolean {
  return fs.existsSync(VIDEOCAPTIONER_EXE_PATH)
}
```

- [ ] **Step 3: Re-export from `testbed.ts`**

Add:

```ts
export { prepareMinimalSrt } from './prepareMinimalSrt'
export { checkVideoCaptionerAvailable } from './checkVideoCaptionerAvailable'
```

(Keep CLI imports on the leaf modules to avoid pulling `@wdio/globals` via testbed — same as `prepareVideoFile`.)

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/test/lib/prepareMinimalSrt.ts apps/e2e/test/lib/checkVideoCaptionerAvailable.ts apps/e2e/test/lib/testbed.ts
git commit -m "test(e2e): add minimal SRT helper and VideoCaptioner discovery"
```

---

### Task 2: CLI — `smm convert`

**Files:**
- Create: `apps/e2e/cli/convert.test.ts`
- Test: run with Bun from `apps/e2e`

**Interfaces:**
- Consumes: `prepareVideoFile`, `setup`/`cleanup`/`bin` from `./base`, `cliOutput` from `./helpers`

- [ ] **Step 1: Write `convert.test.ts`** (mirror `compress.test.ts`)

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import * as cp from 'node:child_process'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareVideoFile } from '../test/lib/prepareVideoFile'

const TEN_MINUTES_MS = 10 * 60 * 1000

function checkFfmpegAvailable(): boolean {
  try {
    cp.execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

const hasFfmpeg = checkFfmpegAvailable()

describe('convert video', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-convert-'))
  })

  afterEach(async () => {
    if (workDir && existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
    workDir = undefined
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
  })

  it.skipIf(!hasFfmpeg)(
    'converts sample.mp4 via smm convert',
    async () => {
      expect(workDir).toBeDefined()
      const inputPath = join(workDir!, 'sample.mp4')
      const outputPath = join(workDir!, 'sample-out.mp4')

      await prepareVideoFile(inputPath)
      expect(existsSync(inputPath)).toBe(true)
      expect(statSync(inputPath).size).toBeGreaterThan(0)

      const ret =
        await $`${bin} convert ${inputPath} -o ${outputPath} --folder ${workDir!} --format mp4h264 --preset balanced`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
      }
      expect(ret.exitCode).toBe(0)
      expect(existsSync(outputPath)).toBe(true)
      expect(statSync(outputPath).size).toBeGreaterThan(0)
    },
    TEN_MINUTES_MS,
  )
})
```

- [ ] **Step 2: Run CLI test**

```bash
cd apps/e2e && bun test cli/convert.test.ts
```

Expected: PASS if ffmpeg present; otherwise skipped via `skipIf`. If ffmpeg present and convert fails, fix CLI/env before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/cli/convert.test.ts
git commit -m "test(e2e): add smm convert CLI coverage with sample.mp4"
```

---

### Task 3: Web UI — ConvertVideo (replace manual)

**Files:**
- Create: `apps/e2e/common/ffmpeg/ConvertVideo.e2e.ts`
- Delete: `apps/e2e/common/manual/ConvertVideoFormat.e2e.ts` (or replace body with a one-line comment pointing to new file — prefer delete to avoid stale manual)

**Interfaces:**
- Consumes: `prepareVideoFile`, CompressVideo-style row/menu/wait helpers
- UI: `[data-testid="format-converter-dialog"]`, `#format-converter-filename`, `[data-testid="format-converter-start"]`

- [ ] **Step 1: Write `ConvertVideo.e2e.ts`**

Copy structure from `CompressVideo.e2e.ts`:

1. `skipIfOhos`; `isFfmpegAvailable = isDockerE2e || checkFfmpegAvailable()`
2. `createAndImportFolderViaBrowser({ folderName, type: 'music', files: ['sample.mp4'] })`
3. `prepareVideoFile(joinPlatformPath(folderPath, 'sample.mp4'))`
4. Clean prior `sample (N).mp4` outputs (regex like compress)
5. Context menu labels `['Format conversion', '格式转换']`
6. Read `#format-converter-filename` value → expect `/sample\s*\(1\)\.mp4/i`
7. Click `[data-testid="format-converter-start"]`
8. Wait until dialog closed / no error (same `browser.execute` pattern as CompressVideo)
9. `waitForOutputFile(folderPath, outputFileName, 8 * 60 * 1000)`
10. `this.timeout(10 * 60 * 1000)`

Do **not** change format to WebM (spec: defaults only).

- [ ] **Step 2: Remove manual ConvertVideoFormat**

```bash
git rm apps/e2e/common/manual/ConvertVideoFormat.e2e.ts
```

- [ ] **Step 3: Typecheck e2e**

```bash
cd apps/e2e && pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/common/ffmpeg/ConvertVideo.e2e.ts
git add -u apps/e2e/common/manual/ConvertVideoFormat.e2e.ts
git commit -m "test(e2e): add ConvertVideo UI e2e and drop manual convert-only suite"
```

---

### Task 4: CLI — `smm transcribe`

**Files:**
- Create: `apps/e2e/cli/transcribe.test.ts`

**Interfaces:**
- Consumes: `prepareVideoFile`, `checkVideoCaptionerAvailable`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareVideoFile } from '../test/lib/prepareVideoFile'
import { checkVideoCaptionerAvailable } from '../test/lib/checkVideoCaptionerAvailable'

const TEN_MINUTES_MS = 10 * 60 * 1000
const hasVc = checkVideoCaptionerAvailable()

describe('transcribe subtitle', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-transcribe-'))
  })

  afterEach(async () => {
    if (workDir && existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
    workDir = undefined
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
  })

  it.skipIf(!hasVc)(
    'transcribes sample.mp4 via smm transcribe',
    async () => {
      expect(workDir).toBeDefined()
      const mediaPath = join(workDir!, 'sample.mp4')
      const srtPath = join(workDir!, 'sample.srt')

      await prepareVideoFile(mediaPath)

      const ret =
        await $`${bin} transcribe ${mediaPath} --folder ${workDir!} --format srt`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
      }
      expect(ret.exitCode).toBe(0)
      expect(existsSync(srtPath)).toBe(true)
      expect(statSync(srtPath).size).toBeGreaterThan(0)
    },
    TEN_MINUTES_MS,
  )
})
```

If VideoCaptioner writes a different stem, adjust `srtPath` after inspecting a local failing run (list `workDir` on failure and fix assertion to the real name). Prefer failing with listed filenames in the error message.

- [ ] **Step 2: Run**

```bash
cd apps/e2e && bun test cli/transcribe.test.ts
```

Expected: skip without VC; PASS with VC + working ASR.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/cli/transcribe.test.ts
git commit -m "test(e2e): add smm transcribe CLI coverage"
```

---

### Task 5: Web UI — Transcribe

**Files:**
- Create: `apps/e2e/common/videocaptioner/Transcribe.e2e.ts`
- Reuse: `MusicPanel.co.ts` (`clickContextMenuSubtitleItem('transcribe')`), `TranscribeDialog.co.ts`

**Interfaces:**
- Consumes: `prepareVideoFile`, `checkVideoCaptionerAvailable`, `waitForFolderFileNames` or browser-fs wait

- [ ] **Step 1: Write UI spec**

Pattern:

1. Gate: `skipIfOhos`; if `!(isDockerE2e || checkVideoCaptionerAvailable())` → `describe.skip`
2. Music folder + `sample.mp4` via `createAndImportFolderViaBrowser` + `prepareVideoFile`
3. Sidebar open folder → `MusicPanel.waitForDataRows(1)`
4. `MusicPanel.rightClick(0)` → `clickContextMenuSubtitleItem('transcribe')`
5. `TranscribeDialogCO.waitForDisplayed()` → `clickConfirm()`
6. Wait until `sample.srt` exists with size > 0 (reuse `waitForFolderFileNames` / `listFileNamesViaBrowser` + size check)
7. Timeout 10 minutes

- [ ] **Step 2: Typecheck**

```bash
cd apps/e2e && pnpm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/common/videocaptioner/Transcribe.e2e.ts
git commit -m "test(e2e): add VideoCaptioner Transcribe UI e2e"
```

---

### Task 6: CLI — `smm translate`

**Files:**
- Create: `apps/e2e/cli/translate.test.ts`

**Interfaces:**
- Consumes: `prepareMinimalSrt`, `checkVideoCaptionerAvailable`
- Assert: exit 0; after run, folder has a `.srt` that is either new or larger/changed vs pre-run snapshot

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareMinimalSrt } from '../test/lib/prepareMinimalSrt'
import { checkVideoCaptionerAvailable } from '../test/lib/checkVideoCaptionerAvailable'

const TEN_MINUTES_MS = 10 * 60 * 1000
const hasVc = checkVideoCaptionerAvailable()

describe('translate subtitle', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-translate-'))
  })

  afterEach(async () => {
    if (workDir && existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
    workDir = undefined
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
  })

  it.skipIf(!hasVc)(
    'translates minimal.srt via smm translate google→en',
    async () => {
      expect(workDir).toBeDefined()
      const srtPath = join(workDir!, 'sample.srt')
      prepareMinimalSrt(srtPath)
      const before = new Map(
        readdirSync(workDir!)
          .filter((n) => n.toLowerCase().endsWith('.srt'))
          .map((n) => [n, statSync(join(workDir!, n)).mtimeMs] as const),
      )

      const ret =
        await $`${bin} translate ${srtPath} --folder ${workDir!} --translator google --target-language en`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
        console.error('dir:', readdirSync(workDir!))
      }
      expect(ret.exitCode).toBe(0)

      const afterNames = readdirSync(workDir!).filter((n) => n.toLowerCase().endsWith('.srt'))
      const changed = afterNames.some((n) => {
        const full = join(workDir!, n)
        const size = statSync(full).size
        if (size <= 0) return false
        const prev = before.get(n)
        return prev === undefined || statSync(full).mtimeMs > prev
      })
      expect(changed).toBe(true)
    },
    TEN_MINUTES_MS,
  )
})
```

- [ ] **Step 2: Run + commit**

```bash
cd apps/e2e && bun test cli/translate.test.ts
git add apps/e2e/cli/translate.test.ts
git commit -m "test(e2e): add smm translate CLI coverage"
```

---

### Task 7: Web UI — Translate (+ MusicPanel CO)

**Files:**
- Modify: `apps/e2e/test/componentobjects/MusicPanel.co.ts` — extend `MusicTrackContextMenuItem` / header helpers for translate
- Create: `apps/e2e/common/videocaptioner/Translate.e2e.ts`

**Interfaces:**
- UI: `[data-testid="music-header-subtitle"]` → `[data-testid="music-header-translate"]`
- Dialog: `[data-testid="subtitle-translation-dialog"]`, `[data-testid="subtitle-translation-dialog-confirm"]`
- Fixtures: `sample.mp4` + `sample.srt` (eligible translate row)

- [ ] **Step 1: Extend MusicPanel CO**

Add methods (names exact):

```ts
async clickHeaderTranslate(): Promise<void> {
  await this.openSubtitleMenu()
  const item = await $('[data-testid="music-header-translate"]')
  await item.waitForClickable({ timeout: 5000 })
  await item.click()
}

async clickHeaderSynthesize(): Promise<void> {
  await this.openSubtitleMenu()
  const item = await $('[data-testid="music-header-synthesize"]')
  await item.waitForClickable({ timeout: 5000 })
  await item.click()
}

async clickHeaderProcess(): Promise<void> {
  await this.openSubtitleMenu()
  const item = await $('[data-testid="music-header-process"]')
  await item.waitForClickable({ timeout: 5000 })
  await item.click()
}
```

- [ ] **Step 2: Write Translate UI e2e**

1. VC gate + OHOS skip
2. Import music folder with `files: ['sample.mp4', 'sample.srt']`
3. `prepareVideoFile` + `prepareMinimalSrt` on those paths
4. Open folder → wait rows
5. `MusicPanel.clickHeaderTranslate()`
6. Wait `[data-testid="subtitle-translation-dialog"]`; click confirm (defaults: google + `zh-Hans` is fine)
7. Snapshot `.srt` names/mtimes before confirm; after job, assert a changed/new `.srt` with size > 0 (same rule as CLI)
8. Timeout 10 min

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/e2e && pnpm run typecheck
git add apps/e2e/test/componentobjects/MusicPanel.co.ts apps/e2e/common/videocaptioner/Translate.e2e.ts
git commit -m "test(e2e): add VideoCaptioner Translate UI e2e"
```

---

### Task 8: CLI — `smm synthesize`

**Files:**
- Create: `apps/e2e/cli/synthesize.test.ts`

**Interfaces:**
- Consumes: `prepareVideoFile`, `prepareMinimalSrt`, `checkVideoCaptionerAvailable`
- Assert: exit 0; new or changed video file in workDir with size > 0 (exclude input `sample.mp4` if unchanged)

- [ ] **Step 1: Write test**

```ts
// same setup/cleanup/skip pattern as translate
const mediaPath = join(workDir!, 'sample.mp4')
const srtPath = join(workDir!, 'sample.srt')
await prepareVideoFile(mediaPath)
prepareMinimalSrt(srtPath)
const beforeVideos = new Map(
  readdirSync(workDir!)
    .filter((n) => /\.(mp4|mkv|webm|mov)$/i.test(n))
    .map((n) => [n, statSync(join(workDir!, n)).mtimeMs] as const),
)

const ret =
  await $`${bin} synthesize ${mediaPath} -s ${srtPath} --folder ${workDir!}`.nothrow()
// expect exit 0
const after = readdirSync(workDir!).filter((n) => /\.(mp4|mkv|webm|mov)$/i.test(n))
const changed = after.some((n) => {
  const full = join(workDir!, n)
  if (statSync(full).size <= 0) return false
  const prev = beforeVideos.get(n)
  return prev === undefined || statSync(full).mtimeMs > prev
})
expect(changed).toBe(true)
```

Timeout 10 min.

- [ ] **Step 2: Run + commit**

```bash
cd apps/e2e && bun test cli/synthesize.test.ts
git add apps/e2e/cli/synthesize.test.ts
git commit -m "test(e2e): add smm synthesize CLI coverage"
```

---

### Task 9: Web UI — Synthesize

**Files:**
- Create: `apps/e2e/common/videocaptioner/Synthesize.e2e.ts`

**Interfaces:**
- `MusicPanel.clickHeaderSynthesize()`
- `[data-testid="synthesize-subtitle-dialog"]`, `[data-testid="synthesize-subtitle-dialog-confirm"]`

- [ ] **Step 1: Write UI e2e**

Same fixture as Translate (mp4 + srt). Open synthesize dialog → Confirm defaults → wait for new/changed video file size > 0 (browser-fs list + size on Docker). Timeout 10 min.

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/e2e && pnpm run typecheck
git add apps/e2e/common/videocaptioner/Synthesize.e2e.ts
git commit -m "test(e2e): add VideoCaptioner Synthesize UI e2e"
```

---

### Task 10: CLI — `smm process` (short path)

**Files:**
- Create: `apps/e2e/cli/process.test.ts`

**Interfaces:**
- Flags: `--no-translate --no-synthesize`
- Assert: exit 0 + `sample.srt` (or discovered stem) size > 0

- [ ] **Step 1: Write test**

```ts
await prepareVideoFile(mediaPath)
const ret =
  await $`${bin} process ${mediaPath} --folder ${workDir!} --no-translate --no-synthesize`.nothrow()
expect(ret.exitCode).toBe(0)
expect(existsSync(join(workDir!, 'sample.srt'))).toBe(true)
expect(statSync(join(workDir!, 'sample.srt')).size).toBeGreaterThan(0)
```

On naming mismatch, log `readdirSync(workDir)` in the failure path and assert the actual `.srt` name.

- [ ] **Step 2: Run + commit**

```bash
cd apps/e2e && bun test cli/process.test.ts
git add apps/e2e/cli/process.test.ts
git commit -m "test(e2e): add smm process short-path CLI coverage"
```

---

### Task 11: Web UI — Process (+ noTranslate testid)

**Files:**
- Modify: `apps/ui/src/components/dialogs/UIProcessPipelineDialog.tsx` — add `data-testid="process-pipeline-no-translate"` on the noTranslate checkbox (mirror `process-pipeline-no-synthesize`)
- Create: `apps/e2e/common/videocaptioner/Process.e2e.ts`

**Interfaces:**
- `MusicPanel.clickHeaderProcess()`
- Dialog: `[data-testid="process-pipeline-dialog"]`, `[data-testid="process-pipeline-no-translate"]`, `[data-testid="process-pipeline-confirm"]`
- UI default already has `noSynthesize === true`; e2e must check **noTranslate** so Confirm does not require target language / translator fill for the short path

- [ ] **Step 1: Add testid in UI**

On the noTranslate `<input type="checkbox">`:

```tsx
data-testid="process-pipeline-no-translate"
```

- [ ] **Step 2: Write Process UI e2e**

1. VC gate; music folder with `sample.mp4` only + `prepareVideoFile`
2. Header → Process
3. Ensure `[data-testid="process-pipeline-no-translate"]` is checked (click if not)
4. Confirm `[data-testid="process-pipeline-confirm"]`
5. Wait for `sample.srt` size > 0
6. Timeout 10 min

- [ ] **Step 3: Typecheck UI + e2e**

```bash
cd apps/ui && pnpm run typecheck
cd ../e2e && pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/dialogs/UIProcessPipelineDialog.tsx apps/e2e/common/videocaptioner/Process.e2e.ts
git commit -m "test(e2e): add VideoCaptioner Process short-path UI e2e"
```

---

### Task 12: knip + smoke gate

**Files:**
- Modify: `knip.json` if needed (`ignoreBinaries` += `"videocaptioner"` when helpers/`execSync` reference it)

- [ ] **Step 1: Run knip**

```bash
pnpm knip
```

Expected: PASS. If unlisted `videocaptioner`, add to `ignoreBinaries` next to `ffmpeg`.

- [ ] **Step 2: Run available CLI suite**

```bash
cd apps/e2e && bun test cli/convert.test.ts cli/transcribe.test.ts cli/translate.test.ts cli/synthesize.test.ts cli/process.test.ts
```

Expected: each either skip (missing binary) or PASS.

- [ ] **Step 3: Commit knip fix if any**

```bash
git add knip.json
git commit -m "chore: ignore videocaptioner binary in knip for e2e probes"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Convert CLI + UI CI, wait size > 0 | 2, 3 |
| Transcribe CLI + UI | 4, 5 |
| Translate CLI + UI, inline srt, google | 6, 7 |
| Synthesize CLI + UI | 8, 9 |
| Process short path CLI + UI noTranslate | 10, 11 |
| Shared helpers / VC discovery | 1 |
| Replace manual Convert | 3 |
| Skip vs fail semantics / OHOS | all gated tasks |
| knip | 12 |
| Non-goals (whisper, full process, quality metrics) | omitted |

No TBD placeholders; translate/synthesize output naming uses before/after dir snapshot rather than hard-coding VC internal names.
