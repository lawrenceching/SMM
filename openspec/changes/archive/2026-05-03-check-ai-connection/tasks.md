## 1. Create API module

- [x] 1.1 Create `apps/ui/src/api/checkAiConnection.ts` with `checkAiConnection(ai, model, apiKey)` that calls `POST /api/ai/check` and returns `{ ai, model, status }`

## 2. Add i18n keys

- [x] 2.1 Add `check`, `checkSuccess`, `checkError` keys to `apps/ui/public/locales/en/settings.json` under `ai`
- [x] 2.2 Add corresponding translations to `zh-CN`, `zh-HK`, `zh-TW` locale files

## 3. Add Check button to AiSettings

- [x] 3.1 Add `checkStatus` state (`'idle' | 'checking' | 'ok' | 'error'`) and `checkMessage` to `AiSettings.tsx`
- [x] 3.2 Add Check button below the model input field, disabled while checking
- [x] 3.3 Implement `handleCheck` that calls `checkAiConnection` with current form values and updates state
- [x] 3.4 Display success/error status text below the button based on check result
- [x] 3.5 Clear check status when the selected provider changes

## 4. Verify

- [x] 4.1 Run `pnpm typecheck` and ensure no new type errors
- [x] 4.2 Run `pnpm test:ui` and ensure all existing tests pass
