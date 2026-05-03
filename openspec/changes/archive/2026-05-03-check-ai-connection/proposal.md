## Why

Users configure AI provider connection details in the settings panel but have no way to verify they work. The backend `POST /api/ai/check` endpoint already exists to test connectivity — the UI just needs a button to trigger it.

## What Changes

- Add a "Check" button next to each AI provider's configuration form in `AiSettings.tsx`
- The button calls `POST /api/ai/check` with the current provider's `ai`, `model`, and `apiKey` form values
- Display connection status inline: a success indicator or error message after the check completes
- The check result is ephemeral — it does not persist or affect the save state

## Capabilities

### New Capabilities
- `ai-settings-check-button`: A "Check" button in the AI settings panel that tests connectivity to the currently selected AI provider via the existing `/api/ai/check` endpoint

### Modified Capabilities
<!-- No existing specs require changes -->

## Impact

- **Modified**: `apps/ui/src/components/ui/settings/AiSettings.tsx` — add Check button, status display, and check handler
- **New file**: `apps/ui/src/api/checkAiConnection.ts` — API function wrapping `POST /api/ai/check`
- **Modified**: `apps/ui/public/locales/en/settings.json` — new i18n keys for the button and status messages
- **Modified**: other locale files (`zh-CN`, `zh-HK`, `zh-TW`) — corresponding translations
