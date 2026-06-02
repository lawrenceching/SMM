# FFmpeg Convert Error Handling

Improve error handling for MusicPanel format conversion (`FormatConverterDialog`). When ffmpeg fails, classify the failure using exit code and stderr patterns (per `.agents/docs/ffmpeg_error_code.md`), and show a user-friendly inline error message inside the dialog. Scope is **convert-only**; other ffmpeg call sites are unchanged.

[ ] New UI component
[ ] New user config
[ ] Electron only
[ ] User document

## 1. Background

MusicPanel opens `FormatConverterDialog` for format conversion. The dialog calls `useConvertVideoMutation` → `convertVideo` → `executeCmdToCompletion({ command: "ffmpeg", ... })`.

On failure today:

```ts
// format-converter-dialog.tsx
catch (err) {
  toast.error(err instanceof Error ? err.message : "Conversion failed.")
}
```

The raw message looks like `ffmpeg exited with code 1: ...` with a truncated stderr blob — not actionable for users.

Reference doc `.agents/docs/ffmpeg_error_code.md` defines:

| Exit code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | Generic error (most cases) |
| 69 | Error rate exceeded (`-max_error_rate`) |
| 123 | Forced exit after repeated signals |

stderr carries more specific hints (`Unknown encoder`, `No such file or directory`, `Permission denied`, etc.).

Existing pattern: `apps/ui/src/lib/ytdlpErrorDetection.ts` classifies yt-dlp stderr into known types. This change follows the same idea but uses **i18n keys** (4 locales) and displays errors **inline in the dialog** (no error toast).

## 2. Project Level Architecture

None.

## 3. App Level Architecture

### 3.1 Data flow

```mermaid
sequenceDiagram
    participant Dialog as FormatConverterDialog
    participant Mutation as useConvertVideoMutation
    participant API as convertVideo
    participant Exec as executeCmdToCompletion
    participant Classify as classifyFfmpegConvertError

    Dialog->>Mutation: convertVideoAsync(params)
    Mutation->>API: convertVideo(params)
    API->>Exec: ffmpeg args
    Exec-->>API: { success:false, exitCode, stderr, error }
    API->>Classify: classify(exitCode, stderr, systemMessage)
    Classify-->>API: { type, i18nKey }
    API-->>Mutation: throw FfmpegConvertError
    Mutation-->>Dialog: rejected promise
    Dialog->>Dialog: setErrorMessage(t(i18nKey))
    Note over Dialog: Inline Alert visible; no toast.error
```

### 3.2 New module: `ffmpegConvertErrorDetection.ts`

Location: `apps/ui/src/lib/ffmpegConvertErrorDetection.ts`

```ts
export type FfmpegConvertErrorType =
  | "timeout"
  | "cancelled"           // exit 123
  | "error-rate-exceeded" // exit 69
  | "encoder-not-found"
  | "decoder-not-found"
  | "muxer-not-found"
  | "demuxer-not-found"
  | "filter-not-found"
  | "invalid-data"
  | "file-not-found"
  | "permission-denied"
  | "disk-full"
  | "out-of-memory"
  | "generic"             // exit 1, unmatched stderr
  | "unknown"             // unexpected exit code / empty signal

export interface FfmpegConvertErrorResult {
  type: FfmpegConvertErrorType
  /** i18n key under dialogs namespace, e.g. formatConverter.errors.encoderNotFound */
  i18nKey: string
}

export function classifyFfmpegConvertError(input: {
  exitCode: number | null
  stderr: string
  systemMessage?: string
}): FfmpegConvertErrorResult
```

**Classification order** (first match wins):

1. `systemMessage` contains `timed out` → `timeout`
2. `exitCode === 123` → `cancelled`
3. `exitCode === 69` → `error-rate-exceeded`
4. stderr regex patterns (case-insensitive), aligned with `ffmpeg_error_code.md`:
   - `Unknown encoder` → `encoder-not-found`
   - `Unknown decoder` → `decoder-not-found`
   - `Unable to find a suitable output format` → `muxer-not-found`
   - `Unable to find a suitable input format` → `demuxer-not-found`
   - `Filter '…' not found` / `Filter not found` → `filter-not-found`
   - `Invalid data found when processing input` → `invalid-data`
   - `No such file or directory` → `file-not-found`
   - `Permission denied` → `permission-denied`
   - `No space left on device` → `disk-full`
   - `Cannot allocate memory` → `out-of-memory`
5. `exitCode === 1` → `generic`
6. fallback → `unknown`

**Note:** ffmpeg writes diagnostics to **stderr** (not stdout). `classifyFfmpegConvertError` reads `stderr` only; `stdout` is ignored for this feature.

For `unknown` / `generic`, log full stderr to `console.error("[ffmpeg-convert]", …)` for debugging; **do not** show stderr in the UI (per requirement).

### 3.3 Custom error: `FfmpegConvertError`

Location: `apps/ui/src/lib/ffmpegConvertErrorDetection.ts` (same file)

```ts
export class FfmpegConvertError extends Error {
  readonly type: FfmpegConvertErrorType
  readonly i18nKey: string

  constructor(result: FfmpegConvertErrorResult) {
    super(result.i18nKey) // fallback for non-i18n consumers
    this.name = "FfmpegConvertError"
    this.type = result.type
    this.i18nKey = result.i18nKey
  }
}
```

### 3.4 API layer change: `convertVideo`

File: `apps/ui/src/api/ffmpeg.ts`

After `executeCmdToCompletion`, on failure:

```ts
import { classifyFfmpegConvertError, FfmpegConvertError } from "@/lib/ffmpegConvertErrorDetection"

// inside convertVideo — throw instead of returning { error }
if (!result.success) {
  const classified = classifyFfmpegConvertError({
    exitCode: result.exitCode,
    stderr: result.stderr,
    systemMessage: result.error,
  })
  throw new FfmpegConvertError(classified)
}
```

`FfmpegConvertResponse.error` remains in the type for backward compatibility but convert path throws on failure. `useConvertVideoMutation` already re-throws — no change needed there except removing redundant `if (result.error) throw`.

### 3.5 UI: `FormatConverterDialog`

File: `apps/ui/src/components/dialogs/format-converter-dialog.tsx`

Changes:

1. Add `errorMessage: string | null` state, cleared when dialog opens or user retries.
2. Replace error `toast.error` with inline `<Alert variant="destructive">` above the footer (or below header).
3. On catch:

```ts
import { FfmpegConvertError } from "@/lib/ffmpegConvertErrorDetection"

catch (err) {
  if (err instanceof FfmpegConvertError) {
    setErrorMessage(t(err.i18nKey))
  } else {
    setErrorMessage(t("formatConverter.errors.unknown"))
  }
}
```

4. Keep `toast.success` on success; keep `toast.error` only for **validation** (`invalidParams`) if desired, or move validation inline too — **validation stays toast** (pre-submit, not ffmpeg failure).
5. Clear `errorMessage` at start of `handleStart` and when `isOpen` becomes true.

### 3.6 i18n keys

Add to `formatConverter.errors` in all 4 locale files (`apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/dialogs.json`):

| Key | EN (example) |
|-----|--------------|
| `errors.timeout` | Conversion timed out. Try a shorter clip or a faster preset. |
| `errors.cancelled` | Conversion was interrupted. |
| `errors.errorRateExceeded` | Too many frames failed to encode. The source file may be corrupted. |
| `errors.encoderNotFound` | Required video/audio encoder is not available in your ffmpeg build. |
| `errors.decoderNotFound` | Cannot decode the source file. The codec may not be supported. |
| `errors.muxerNotFound` | Cannot write the selected output format. |
| `errors.demuxerNotFound` | Cannot read the source file format. |
| `errors.filterNotFound` | A required ffmpeg filter is not available. |
| `errors.invalidData` | The source file contains invalid or corrupted data. |
| `errors.fileNotFound` | Source or output path not found. |
| `errors.permissionDenied` | Permission denied. Check folder access rights. |
| `errors.diskFull` | Not enough disk space to write the output file. |
| `errors.outOfMemory` | Not enough memory to complete conversion. |
| `errors.generic` | Conversion failed. Check the application log for details. |
| `errors.unknown` | Conversion failed due to an unexpected error. |

Update `apps/ui/src/types/i18next.d.ts` `formatConverter` section with `errors` keys.

## 4. User Stories

### 4.1 Encoder missing → friendly inline message

* **Given** — User opens Format Converter for a music/video file and selects WebM output
* **When** — ffmpeg exits code 1 with stderr `Unknown encoder 'libvpx-vp9'`
* **Then** — Dialog shows inline alert "Required video/audio encoder is not available…" (localized); no error toast; dialog stays open for retry

### 4.2 Source file missing

* **Given** — Source file was deleted after dialog opened
* **When** — ffmpeg exits with `No such file or directory`
* **Then** — Inline alert "Source or output path not found."

### 4.3 Timeout

* **Given** — Conversion exceeds 1 hour timeout
* **When** — `executeCmdToCompletion` sets systemMessage `ffmpeg command timed out`
* **Then** — Inline alert about timeout

### 4.4 Unknown error — no stderr leak

* **Given** — ffmpeg fails with unrecognized stderr
* **When** — Classification returns `unknown`
* **Then** — User sees generic unknown message; full stderr logged to console only

### 4.5 Success unchanged

* **Given** — Conversion succeeds
* **When** — exit code 0
* **Then** — Success toast, dialog closes (existing behavior)

## 5. Tasks

### 5.1 Error classification module

- [x] Create `apps/ui/src/lib/ffmpegConvertErrorDetection.ts` with types, classifier, `FfmpegConvertError`
- [x] Create `apps/ui/src/lib/ffmpegConvertErrorDetection.test.ts` covering exit codes 1/69/123, each stderr pattern, timeout, unknown

### 5.2 API integration

- [x] Update `convertVideo` in `apps/ui/src/api/ffmpeg.ts` to throw `FfmpegConvertError`
- [x] Simplify `useConvertVideoMutation` if redundant error check remains

### 5.3 Dialog UI

- [x] Add inline error + `errorMessage` state to `format-converter-dialog.tsx`
- [x] Remove ffmpeg failure `toast.error`; keep success toast
- [x] Clear error on open / retry

### 5.4 i18n

- [x] Add `formatConverter.errors.*` to en, zh-CN, zh-HK, zh-TW `dialogs.json`
- [x] Update `apps/ui/src/types/i18next.d.ts`

### 5.5 Tests

- [x] Extend `format-converter-dialog.test.tsx` — mock `FfmpegConvertError`, assert inline alert text, no error toast
- [x] Unit tests for classifier (primary coverage in dedicated test file)

## 6. Backward Compatibility

- `convertVideo` behavior change: throws instead of returning `{ error }`. Only consumed by `useConvertVideoMutation` today — safe within scope.
- Other ffmpeg functions (`generateFfmpegScreenshots`, `writeMediaTags`, etc.) unchanged.
- No HTTP API or CLI changes.
- No user config changes.

## 7. Documents

None required for end users. Reference doc `.agents/docs/ffmpeg_error_code.md` already exists.

## 8. Post Verification

- [x] Unit tests — `pnpm test:ui` (classifier + dialog tests)
- [x] Typecheck — `pnpm typecheck`
- [ ] Manual — trigger encoder-not-found or invalid source in Format Converter and confirm inline alert + no stderr in UI
