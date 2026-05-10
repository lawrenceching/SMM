## Context

**TranscribeDialog** already passes an optional **ASR** engine to `/api/videocaptioner/transcribe` when a feature flag is on (`TranscribeDialog.tsx`, `apps/cli/src/route/videocaptioner/Transcribe.ts`). Transcribe entry points across music, TV, and movie panels disable **Transcribe** when VideoCaptioner discovery reports unavailable. This change adds a **Provider** switch, VideoCaptioner-aligned CLI options per [VideoCaptioner transcribe docs](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md), and a **Tencent ASR** path with user-supplied **Base URL** and **API Key**.

## Goals / Non-Goals

**Goals:**

- Single dialog UX: provider-specific controls swap visibility when the user changes **Provider**.
- VideoCaptioner: map UI to `--asr`, `--language`, `--word-timestamps`, `--format` only (`srt` | `ass` | `txt` | `json`; language ISO 639-1 code or `auto`).
- Tencent ASR: collect base URL + API key in-dialog; block confirm until both non-empty (trimmed).
- Backend validates provider-specific payloads; VideoCaptioner path unchanged except extended optional fields.
- Transcribe toolbar/menu actions enabled when either VideoCaptioner is discovered **or** Tencent ASR is enabled for the app (feature flag), so users without the CLI can still open the dialog and choose Tencent.

**Non-Goals:**

- Persisting Tencent credentials in user config (optional follow-up); shipping Tencent SDK branding/docs beyond what’s needed to call the API.
- Supporting VideoCaptioner CLI flags not listed above (`-o`, whisper-api keys, etc.).
- Changing multi-file queue semantics or toast behavior beyond provider-specific API calls.

## Decisions

1. **Separate HTTP routes vs one unified transcribe endpoint**  
   **Decision:** Keep **`POST /api/videocaptioner/transcribe`** for VideoCaptioner-only body extensions; add **`POST /api/tencent-asr/transcribe`** (or similarly named) for Tencent with `{ mediaPath, baseUrl, apiKey }`.  
   **Rationale:** Clear validation per provider; avoids ambiguous unions on one schema; matches existing VideoCaptioner route naming.  
   **Alternative:** Single `/api/transcribe` with `provider` discriminator — fewer URLs but heavier validation and coupling.

2. **Where Tencent ASR is implemented**  
   **Decision:** Implement in **`apps/cli`**: resolve `mediaPath`, construct request to `baseUrl` using `apiKey` per Tencent ASR HTTP contract (exact headers/body filled during implementation from Tencent documentation).  
   **Rationale:** Keeps secrets off the renderer if keys are only sent to same-origin CLI; allows file access on desktop.

3. **Feature gating**  
   **Decision:** Add something like `isTencentAsrTranscribeEnabled` in **`useFeatures`** (parallel to existing VideoCaptioner ASR flag). Enable transcribe entry points when `videocaptionerAvailable || isTencentAsrTranscribeEnabled`.  
   **Rationale:** Matches user expectation that Tencent works without local CLI; avoids enabling for all users until product toggles it.

4. **Defaults for new VideoCaptioner fields**  
   **Decision:** `language`: `auto`; `wordTimestamps`: off; `format`: `srt` (CLI defaults).  
   **Rationale:** Matches VideoCaptioner CLI documentation defaults.

5. **Client payload shape for feedback helper**  
   **Decision:** Extend confirm callback / `transcribeTracksWithFeedback` (or equivalent) to accept `provider` plus either `{ asr, language, wordTimestamps, format }` or `{ baseUrl, apiKey }`.  
   **Rationale:** Single code path for queue + toasts with branching HTTP call.

## Risks / Trade-offs

- **[Risk]** User-supplied **Base URL** + **API Key** in-dialog — phishing or typo’d endpoints.  
  **Mitigation:** Validate URL scheme/host patterns server-side; never log raw API keys; consider trimming only.

- **[Risk]** Tencent API shape may differ by product/version.  
  **Mitigation:** Encapsulate in one module; unit-test with mocked HTTP; document assumption in code comment.

- **[Risk]** Enabling transcribe without VideoCaptioner may confuse users who default to VideoCaptioner provider.  
  **Mitigation:** Keep default provider **VideoCaptioner**; confirm remains invalid if VC selected but executable missing (handled by API error + existing failure toasts) — *optional*: disable VC provider when unavailable (spec can leave as implementation choice; prefer still showing VC with clear runtime error to avoid hiding option).

Actually user might want VC disabled when unavailable - I'll note in design as open: prefer allowing selection and failing at API with toast vs disabling provider - I'll say "If VideoCaptioner unavailable, UI may disable VideoCaptioner option or keep it and rely on API failure — pick one during implementation; default to disable VideoCaptioner provider option when discovery says unavailable."

I'll add that to Open Questions or Decisions.

**Decision 6:** When VideoCaptioner is undiscovered, **disable** the **VideoCaptioner** provider option (or entire provider select except Tencent) so users cannot confirm an impossible path. Tencent remains selectable when Tencent feature is on.

## Migration Plan

- Ship behind feature flags for Tencent and optionally grouped flag for new VideoCaptioner fields if needed.
- No database migration; existing transcribe calls without new fields behave as today (`asr` optional, defaults).

## Open Questions

- Exact Tencent ASR REST contract (path, auth header name, audio upload vs URL) — resolve from vendor docs during implementation.
- Whether to persist last-used provider and VC options in local storage (deferred).
