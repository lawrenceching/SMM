## 1. Types and feature flags

- [x] 1.1 Add TypeScript types for transcribe **provider** (`videoCaptioner` | `tencentAsr`), VideoCaptioner extras (`language`, `wordTimestamps`, `format`), and Tencent fields (`baseUrl`, `apiKey`)
- [x] 1.2 Extend `useFeatures` (or equivalent) with **`isTencentAsrTranscribeEnabled`** and wire env/feature source consistent with existing flags

## 2. TranscribeDialog UI

- [x] 2.1 Add **Provider** `Select` to `UITranscribeDialog` with **VideoCaptioner** / **Tencent ASR**; reset or preserve sensible defaults when switching
- [x] 2.2 When **VideoCaptioner** is selected, show existing ASR selector plus **Language** (default `auto`), **Word timestamps** toggle, **Format** select (`srt` | `ass` | `txt` | `json`)
- [x] 2.3 When **Tencent ASR** is selected, show **Base URL** and **API Key** inputs; hide VideoCaptioner-only controls
- [x] 2.4 Block confirm when Tencent is selected and either credential is empty (trimmed); optionally disable **VideoCaptioner** provider when discovery reports unavailable (per `design.md`)
- [x] 2.5 Add i18n strings for new labels under existing dialog namespaces

## 3. Client transcribe pipeline

- [x] 3.1 Extend `TranscribeDialog` / `onConfirm` payload to pass provider and provider-specific options
- [x] 3.2 Update `transcribeTracksWithFeedback` (and any API helpers) to call **`POST /api/videocaptioner/transcribe`** with `{ mediaPath, asr?, language?, wordTimestamps?, format? }` for VideoCaptioner
- [x] 3.3 Call **`POST /api/tencent-asr/transcribe`** (final path per design) with `{ mediaPath, baseUrl, apiKey }` for Tencent; preserve sequential queue + toast behavior

## 4. CLI VideoCaptioner route

- [x] 4.1 Extend `transcribeRequestSchema` and `transcribeWithVideoCaptioner` to accept optional `language`, `wordTimestamps`, `format` and map to **`videocaptioner transcribe`** CLI flags
- [x] 4.2 Add/adjust unit tests in `Transcribe.test.ts` for new fields and invalid `format`

## 5. CLI Tencent ASR

- [x] 5.1 Register new Hono route for Tencent ASR transcribe with Zod validation (`mediaPath`, `baseUrl`, `apiKey`)
- [x] 5.2 Implement Tencent HTTP integration module (auth headers/body per vendor docs), error mapping, and avoid logging secrets
- [x] 5.3 Add route tests with mocked fetch/client

## 6. Panel gating

- [x] 6.1 Update **Music** / **TV** / **Movie** transcribe controls to enable when VideoCaptioner is available **or** `isTencentAsrTranscribeEnabled` is true

## 7. Verification

- [x] 7.1 Add or update UI tests for provider switching, Tencent validation, and VideoCaptioner option visibility
- [x] 7.2 Run `pnpm test:cli` and `pnpm test:ui` for touched packages
