## Why

Transcription always used VideoCaptioner’s default ASR (`bijian`), while the CLI supports multiple engines (`jianying`, `whisper-cpp`). Users who need a different engine should be able to choose it in **TranscribeDialog** without editing code or running the CLI manually.

## What Changes

- Add an **ASR** control (Shadcn UI **Select**, Radix) on **TranscribeDialog** with options: **`bijian`** (default), **`jianying`**, **`whisper-cpp`** (explicitly **not** `whisper-api`).
- Thread the chosen value through the UI transcribe pipeline into the backend so **`videocaptioner transcribe`** is invoked with **`--asr <engine>`** matching [VideoCaptioner CLI](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md).
- Extend **`POST /api/videocaptioner/transcribe`** with an optional, validated **`asr`** field; omitting it preserves today’s default behavior (**`bijian`**) for callers without the dialog (e.g. Music panel).

## Capabilities

### New Capabilities

- `transcribe-dialog-asr`: **TranscribeDialog** exposes ASR selection and the chosen engine is used for that confirmation’s transcribe jobs end-to-end.

### Modified Capabilities

- `videocaptioner-integration`: Transcription API and VideoCaptioner invocation SHALL accept an optional ASR engine aligned with the CLI (`bijian` | `jianying` | `whisper-cpp`), defaulting to `bijian` when unspecified.

## Impact

- **UI**: `UITranscribeDialog`, `TranscribeDialog`, `transcribeFeedback` / API client types, locale strings as needed.
- **CLI**: `Transcribe` route validation, `transcribeWithVideoCaptioner` args.
- **Tests**: API/unit tests for transcribe request body and any dialog tests that assert layout.
