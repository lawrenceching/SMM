# LLM Translator Fields (Configured / Custom)

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

Subtitle translation and process-pipeline dialogs support VideoCaptioner `--translator llm`, which needs `apiKey` / optional `apiBase` / `model`. Today the UI only exposes empty manual inputs and does not reuse Settings → AI (`userConfig.aiProviders` / `selectedAIProvider`).

Goal: let users pick a configured provider **or** enter custom credentials, via a shared controlled component used by both dialogs. Types and job/CLI payloads stay unchanged.

## 2. Architecture

## 2.1 Project Level Architecture

UI-only change in `apps/ui`. Reads `UserConfig` via existing `useConfig()`. Confirm payloads still pass `llm: { apiKey, apiBase?, model? }` into existing job factories / VideoCaptioner CLI builders. No changes to `apps/server`, `apps/core`, or VideoCaptioner.

## 2.2 App Level Architecture

```
UISubtitleTranslationDialog ──┐
                              ├── LlmTranslatorFields (controlled)
UIProcessPipelineDialog ──────┘         │
                                        ├── useConfig() → aiProviders
                                        └── pure helpers (valid / resolve payload)
```

## 2.3 Key Design

- **Mode B:** `configured` | `custom`
  - Configured: provider `<Select>`; baseURL / model / apiKey shown **read-only** (apiKey masked)
  - Custom: editable apiKey / apiBase / model
- **Controlled value** owned by parent dialogs; component does not own confirm logic
- **Pure helpers** (providers passed in): `isLlmTranslatorFieldsValid`, `resolveLlmTranslatorPayload`
- **Persistence:** localStorage for mode + provider name only (never custom apiKey)
- **Empty providers:** Configured disabled / hint to Settings → AI; Custom still available
- **Out of scope:** editing Settings AI list; Bing; job schema; VideoCaptioner

## 3. User Stories

### 3.1 Translate with configured provider

* **Given** user has `aiProviders` with a complete provider selected as `selectedAIProvider`
* **When** they open Translate / Process Pipeline, choose LLM, leave Source = Configured, confirm
* **Then** job payload `llm` is filled from that provider

### 3.2 Translate with custom credentials

* **Given** user chooses Source = Custom and fills apiKey (and optional base/model)
* **When** they confirm
* **Then** job payload `llm` uses the custom fields

### 3.3 Incomplete configured provider blocks confirm

* **Given** selected provider is missing apiKey / baseURL / model
* **When** Source = Configured
* **Then** Confirm stays disabled until fixed in Settings or user switches to Custom
