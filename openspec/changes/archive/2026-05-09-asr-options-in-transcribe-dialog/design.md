## Context

VideoCaptioner is spawned from **`apps/cli`** via **`transcribeWithVideoCaptioner(mediaPath)`**, which currently hardcodes **`--asr bijian`**. The UI **`POST /api/videocaptioner/transcribe`** body only accepts **`mediaPath`**. **TranscribeDialog** → **`UITranscribeDialog`** is the TV/movie entry point; **MusicPanel** calls **`transcribeTracksWithFeedback`** directly without this dialog and should keep working without UI changes.

## Goals / Non-Goals

**Goals:**

- Add an ASR **Select** ([Shadcn Radix Select](https://ui.shadcn.com/docs/components/radix/select)) on **`UITranscribeDialog`**, default **`bijian`**, options **`jianying`** and **`whisper-cpp`** only (no **`whisper-api`**).
- Plumb **`asr`** from dialog confirm → **`TranscribeDialog`** → **`transcribeTracksWithFeedback`** / **`transcribeWithVideoCaptioner`** (UI API) → CLI route → **`spawn`** args **`--asr <value>`**.
- Preserve backward compatibility: missing **`asr`** in JSON behaves as **`bijian`** (matches today’s CLI behavior).

**Non-Goals:**

- Persisting ASR preference in user config.
- Exposing ASR on Music panel UI in this change (optional follow-up).
- Supporting **`whisper-api`** or other engines.

## Decisions

1. **Request shape**: Extend **`POST /api/videocaptioner/transcribe`** JSON with optional **`asr`**. Validate with **`zod`** enum **`["bijian","jianying","whisper-cpp"]`** in **`apps/cli`**. Mirror the union in **`apps/ui`** API types.

2. **`transcribeWithVideoCaptioner` signature**: Add optional second argument or options object, e.g. **`{ asr?: ... }`**, defaulting internally to **`bijian`** so **`processVideoCaptionerTranscribe`** stays a thin wrapper.

3. **Dialog callback**: Extend **`onConfirm`** to pass the selected ASR together with **`selectedIds`** (e.g. single **`payload`** object) so **`TranscribeDialog`** can forward **`asr`** into **`transcribeTracksWithFeedback`** without prop drilling multiple positional parameters.

4. **Shared types**: No **`packages/core`** change unless duplication becomes painful; keep CLI Zod + UI TypeScript union aligned (same three string literals).

5. **i18n**: Add **`dialogs.transcribe.asr`** label and per-option labels (or reuse engine id strings where acceptable per existing patterns).

## Risks / Trade-offs

- **Enum drift** between UI and CLI → Mitigation: single source in CLI (**zod**); UI documents the same literals in **`VideoCaptionerTranscribeRequest`**.
- **Whisper-cpp** may fail on user machines without local deps → Mitigation: user-selected; errors already surfaced via existing failure toasts/API errors.

## Migration Plan

Deploy with backward-compatible API default; no data migration.

## Open Questions

None for this scope.
