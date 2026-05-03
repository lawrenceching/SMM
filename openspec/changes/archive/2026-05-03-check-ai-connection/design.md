## Context

`AiSettings.tsx` renders a provider selector (`Combobox`) and a config form (`baseURL`, `apiKey`, `model` inputs) for the selected AI provider. Form values are held in local state (`providerConfigs[selectedProvider]`) and written to `smm.json` only on save via `setAndSaveUserConfig`. The backend `POST /api/ai/check` endpoint (already built) accepts `{ ai, model, apiKey }` and returns `{ ai, model, status }`.

The UI uses direct `fetch()` calls — no API wrapper, no `baseURL` configuration — since the dev server proxies `/api/*` to the CLI backend.

## Goals / Non-Goals

**Goals:**
- Add a "Check" button in the AI provider config form (next to the model field)
- On click, call `POST /api/ai/check` with the current form values for `ai`, `model`, `apiKey`
- Display connection status (success/error) inline below the form
- The check result is transient — it does not affect the save/dirty state

**Non-Goals:**
- Checking all providers at once (only the currently selected one)
- Persisting check results
- Validating `baseURL` connectivity separately
- Testing provider capabilities beyond basic connectivity

## Decisions

1. **New API module `apps/ui/src/api/checkAiConnection.ts`** — Follow the existing pattern of one file per API endpoint. Export a typed function `checkAiConnection(ai, model, apiKey)` that wraps `fetch('/api/ai/check')`.

2. **Local React state for check result** — Use `useState` for `checkStatus: 'idle' | 'checking' | 'ok' | 'error'` and an optional `checkMessage` string. This keeps the feature self-contained in `AiSettings.tsx` without a new store or TanStack Query hook.

3. **Check uses current form values (not saved config)** — The user may have edited fields but not yet saved. Using form `providerConfigs[selectedProvider]` values lets them test before committing.

4. **Button placed below the model input** — Visually groups the button with the fields it depends on. Uses the existing `Button` component.

5. **Status display** — Show a green checkmark + "Connected" on success, red alert + error message on failure. Text content via i18n keys (`ai.checkSuccess`, `ai.checkError`, `ai.checkChecking`).

6. **Minimal i18n additions** — Add only 3 new keys: `check`, `checkSuccess`, `checkError`. No new translation namespaces.

## Risks / Trade-offs

- **API key is sent in plaintext** — Same as the existing `/api/ai/check` endpoint. The key is already in local form state. → No new risk.
- **Network latency** — The check takes 1-5 seconds. → Show a loading state on the button (spinner or "Checking..." text) to give feedback.
- **Duplicate clicks** — User might spam the button. → Disable the button while a check is in progress.
