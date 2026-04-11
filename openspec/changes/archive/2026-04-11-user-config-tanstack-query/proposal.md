## Why

Persisted user settings (`smm.json`) are today duplicated in React Context (`useState`), which makes cache coherence, loading/error states, and coordination with startup and socket events harder than necessary. Moving **`UserConfig`** to TanStack Query aligns with the rest of the app (existing `QueryClientProvider`), gives one authoritative cache, and standardizes reads (query) and writes (mutations) with clear invalidation.

## What Changes

- **UserConfig** is loaded and cached via TanStack Query (`useQuery`) keyed by `userDataDir`, not held as duplicate state in `ConfigProvider`.
- **Saves** (full config write, add media folder) use **`useMutation`**-style flows that persist to disk and update the query cache (`setQueryData` / invalidation as appropriate).
- **Bootstrap** (`reload` after `hello()`) uses the query client to **fetch** / populate user config; **AppInitializer** and related flows consume the same data path.
- **External updates** (e.g. `UserConfigUpdated`, some metadata paths) **`invalidateQueries`** (or equivalent) on the user-config key instead of ad-hoc context reloads where a refetch is enough.
- **`appConfig`** (version, `userDataDir`, etc.) remains separate from disk-backed `UserConfig`, still provided by `ConfigProvider` (or equivalent bootstrap), without mixing two sources of truth in one `useState` for user settings.
- Optional thin hooks (**`useUserConfig`**, save/add-folder mutations) wrap the query/mutation API for call sites that prefer that shape.
- **No BREAKING** changes to persisted JSON shape or public IPC/API contracts; this is an internal UI data-layer refactor. DOM / E2E selectors (e.g. config dialog test ids) stay stable.

## Capabilities

### New Capabilities

- `user-config-query`: Defines requirements for how the UI loads, displays, updates, and invalidates persisted user settings (`smm.json`) using TanStack Query as the single client-side source of truth, including interaction with bootstrap and socket-driven refresh.

### Modified Capabilities

- _(none — no existing `openspec/specs/` capabilities to delta.)_

## Impact

- **Primary**: `apps/ui` — `ConfigProvider`, `AppInitializer`, settings components (`GeneralSettings`, `AiSettings`, etc.), `readUserConfig` / write paths, event listeners that refresh config, and any hook that read `useConfig().userConfig` or `setAndSaveUserConfig`.
- **Dependencies**: `@tanstack/react-query` (already in app).
- **Tests**: Unit tests that mock `useConfig` or mount providers may need `QueryClientProvider` where components use query hooks; E2E page objects unchanged if DOM/test ids unchanged.
