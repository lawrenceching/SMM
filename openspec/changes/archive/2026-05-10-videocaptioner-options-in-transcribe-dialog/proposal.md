## Why

Users need to choose between **VideoCaptioner** (local CLI with configurable ASR and output) and **Tencent ASR** (hosted API with user-supplied endpoint and key) from one place. Today the dialog only exposes VideoCaptioner ASR; extending it avoids separate flows and matches how [VideoCaptioner CLI `transcribe`](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md) accepts `--language`, `--word-timestamps`, and `--format`.

## What Changes

- Add a **Provider** control in **TranscribeDialog**: **VideoCaptioner** | **Tencent ASR**.
- When **VideoCaptioner** is selected: show existing **ASR** selector plus **Language**, **Word timestamps**, and **Format** (values aligned with `videocaptioner transcribe`; no other CLI flags).
- When **Tencent ASR** is selected: show **Base URL** and **API Key** inputs; hide VideoCaptioner-only controls.
- Switching providers updates which argument controls are visible.
- Extend backend/client transcription flow so VideoCaptioner jobs receive the new CLI options; add (or extend) API support for Tencent ASR using the supplied base URL and API key.
- Relax UI gating so **Transcribe** entry points remain usable when Tencent ASR is available even if the VideoCaptioner executable is not, consistent with the selected provider in the dialog.

## Capabilities

### New Capabilities

- `tencent-asr-transcription`: Server-side (or app-mediated) transcription path that accepts `mediaPath`, `baseUrl`, and `apiKey`, validates input, calls Tencent ASR according to the chosen integration shape, and returns success/failure compatible with existing UI job feedback.

### Modified Capabilities

- `transcribe-dialog-asr`: Add provider selection; conditional VideoCaptioner fields (ASR, language, word timestamps, format); Tencent fields (base URL, API key); validation on confirm.
- `videocaptioner-integration`: Extend the VideoCaptioner transcribe request and CLI invocation with optional `language`, `wordTimestamps`, and `format` mapped to `--language`, `--word-timestamps`, and `--format`.
- `transcribe-ui-feedback`: Update transcribe action gating so actions are enabled when VideoCaptioner is available **or** Tencent ASR transcription is supported by the app (per feature/configuration), not only when VideoCaptioner is discovered.
- `music-panel-transcribe`: Align header and context-menu transcribe availability with the updated gating; keep dialog row mapping but allow routing to the appropriate transcription API per provider.
- `tv-movie-panel-transcribe`: Same gating and pipeline alignment as music panel for TV/movie headers and rows.

## Impact

- **UI**: `TranscribeDialog` / `UITranscribeDialog`, types, `transcribeFeedback` (or equivalent), feature flags in `useFeatures`, possibly i18n keys.
- **CLI**: `VideoCaptioner` utils and `/api/videocaptioner/transcribe` schema; new Tencent ASR route and HTTP client logic.
- **Tests**: UI unit tests for dialog branches; CLI route tests for extended body and Tencent path.
- **Specs**: One new capability delta + five modified capability deltas under this change.
