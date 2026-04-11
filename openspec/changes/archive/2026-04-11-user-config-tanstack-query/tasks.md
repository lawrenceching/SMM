## 1. Query infrastructure

- [x] 1.1 Add shared `QueryClient` module and wire `main.tsx` to import it (single provider instance).
- [x] 1.2 Add `userConfigQueryKey(userDataDir)` helper for stable cache keys.
- [x] 1.3 Expose `readUserConfigFromUserDataDir(userDataDir)` and keep `readUserConfig()` delegating to it.

## 2. ConfigProvider and hooks

- [x] 2.1 Replace `useState` for `UserConfig` with `useQuery` keyed by `userDataDir`, with `enabled` when the directory is known.
- [x] 2.2 Implement save and add-folder flows with `useMutation` (await `writeFile`, then `setQueryData` on success).
- [x] 2.3 Implement `reload()` using `hello()` + `queryClient.fetchQuery` for user config; keep `onSuccess` bootstrap contract for `AppInitializer`.
- [x] 2.4 Add `refreshUserConfig()` using `invalidateQueries` on the user-config key.
- [x] 2.5 Sync `changeLanguage` when `applicationLanguage` changes from query data or on save.
- [x] 2.6 Expose optional `useUserConfig`, `useSaveUserConfigMutation`, `useAddMediaFolderMutation` wrappers.

## 3. Event listeners and consumers

- [x] 3.1 Update `UserConfigUpdatedEventListener` and relevant paths to call `refreshUserConfig` instead of redundant reload-only flows where appropriate.
- [x] 3.2 Keep folder-rename listener behavior using functional cache updates (`setQueryData`) consistent with prior `setUserConfig` semantics.

## 4. Verification

- [x] 4.1 Run `pnpm run typecheck` for `apps/ui`.
- [x] 4.2 Run targeted UI tests / fix wrappers (`QueryClientProvider`) where components use query hooks.
- [ ] 4.3 Smoke-test Config dialog save, language change, and folder add/remove in the Electron app.
