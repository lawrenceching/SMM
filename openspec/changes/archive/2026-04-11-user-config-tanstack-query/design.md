## Context

The UI already wraps the app in `QueryClientProvider` (`main.tsx`). Persisted settings live in `smm.json` under the directory returned by `hello().userDataDir`. Previously, `ConfigProvider` mirrored that file in React `useState`, with manual `reload`, save, and folder-add paths updating that state and disk separately.

## Goals / Non-Goals

**Goals:**

- TanStack Query is the **single client-side source of truth** for `UserConfig` once `userDataDir` is known.
- **Reads** use a stable **query key** that includes `userDataDir` so cache is correct per data directory.
- **Writes** go through mutations (or equivalent) that **await** persistence then **update the cache** (`setQueryData`) or **invalidate** when the authoritative copy may have changed elsewhere.
- **Bootstrap** (`hello` + first load of `smm.json`) populates the same cache path used everywhere else.
- **Socket / document events** that mean “config on disk changed” trigger **cache invalidation** (or targeted refetch), not a parallel state copy.
- **`appConfig`** (runtime paths, version) stays separate from the `UserConfig` query.

**Non-Goals:**

- Changing the **on-disk JSON schema** or backend APIs (`readFile` / `writeFile` / `hello`).
- Rewriting every consumer to new hook names in one pass (optional wrappers are fine; `useConfig` may still expose `userConfig` for compatibility).

## Decisions

1. **Query key shape** — Use `['userConfig', userDataDir]` (factory in `userConfigQueryKeys.ts`) so invalidation is explicit and multi-profile safe if `userDataDir` ever changes in tests or future features.

2. **Where the query lives** — Centralize the `useQuery` + mutations in **`ConfigProvider`** (or a dedicated child provider) so existing `useConfig().userConfig` call sites keep working with minimal churn; add thin exports (`useUserConfig`, mutation hooks) for new code.

3. **Bootstrap** — After `hello()`, use **`queryClient.fetchQuery`** (or `ensureQueryData`) for the user-config key so `reload()` and the query hook share one cache entry; **`AppInitializer`** keeps using `reload({ onSuccess })` for media metadata initialization.

4. **Language (`changeLanguage`)** — Run when persisted `applicationLanguage` **changes** (effect on query data and/or in save mutation before write), so refetches and saves stay aligned with i18n.

5. **Socket: `userConfigUpdated`** — Prefer **`invalidateQueries`** on the user-config key over a full `hello`+reload unless product needs version refresh every time (can still call `reload` if required later).

6. **In-memory-only updates** — Events that only adjust folder paths in memory without a new file read may use **`setQueryData`** with a functional updater (same as prior `setUserConfig` updater).

**Alternatives considered**

- **Global store only (Zustand/Context)** — Rejected; team direction and app already standardize on TanStack Query for server-adjacent state.
- **One query without `userDataDir` in the key** — Rejected; risks stale cache if the data directory changes between sessions or tests.

## Risks / Trade-offs

- **Double source during transition** — If some code still caches `UserConfig` locally, it can drift. **Mitigation:** route all reads through the query (or `useConfig` backed by it); grep for stray copies.
- **Tests without `QueryClientProvider`** — Components under `ConfigProvider` now need the same client as the app. **Mitigation:** shared test helper wrapping `QueryClientProvider` + `ConfigProvider`, or mock `useConfig` where appropriate.
- **Strict mode double mount** — Query + effects may run twice in dev; **Mitigation:** idempotent `fetchQuery` / invalidation; avoid non-idempotent side effects solely in render.

## Migration Plan

1. Land query key helper + `readUserConfigFromUserDataDir` (or equivalent).
2. Refactor `ConfigProvider` to use `useQuery` / mutations; keep public `useConfig` shape where possible.
3. Switch socket listeners from ad-hoc reload to **`invalidateQueries`** where sufficient.
4. Run `typecheck` and targeted tests; fix wrappers/mocks.
5. Optional: migrate call sites to `useUserConfig` / named mutations incrementally.

**Rollback:** Revert the provider + listener changes; disk format unchanged so rollback is a code-only revert.

## Open Questions

- Whether any flow still requires **`hello()` on every** external config notification (for version/uptime) vs. **invalidate user config only** — product decision; current design favors invalidate-only for `userConfigUpdated`.
