---
name: tmdb-asset-server-debug-override
description: "Add debug.overrideDefaultTmdbAssetServerHost localStorage flag to force TMDB asset server failover in e2e tests"
type: spec
status: approved
---

# TMDB Asset Server Debug Override

## Problem

E2E tests need a way to verify the TMDB asset server failover mechanism works correctly. Currently `TMDB_IMAGE_HOSTS` hardcodes `["image.tmdb.org"]` with no runtime override, so the first download candidate always succeeds against the real CDN, making failover untestable.

## Design

### 1. LocalStorage Debug Flag

Add support for `debug.overrideDefaultTmdbAssetServerHost` in localStorage. When set, the `buildAssetUrlCandidates` function replaces the host of the first (default) image URL candidate with the override value.

### Implementation

**File: `apps/ui/src/lib/assetImageUrls.ts`**

Add a helper to read the localStorage debug override:

```ts
function getOverrideDefaultTmdbAssetServerHost(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('debug.overrideDefaultTmdbAssetServerHost')
  } catch {
    return null
  }
}
```

Modify `buildAssetUrlCandidates` to apply the override after building the full candidate list (including discover-host-swapped fallbacks):

```
Before return:
  candidates = [
    "https://image.tmdb.org/t/p/w500/abc.jpg",    // original CDN
    "https://mirror1.example.com/t/p/w500/abc.jpg", // discover asset mirror
    ...
  ]

After override (when debug.overrideDefaultTmdbAssetServerHost = 'wronghost.tmdb.local'):
  candidates = [
    "https://wronghost.tmdb.local/t/p/w500/abc.jpg",  // overridden — will fail
    "https://mirror1.example.com/t/p/w500/abc.jpg",   // discover — will succeed
    ...
  ]
```

Key invariants:
- Asset type detection (`assetTypeForHost`) checks the **original** hostname, so discover fallbacks are still generated
- Only the first candidate's host is replaced; subsequent candidates (discover mirrors) are untouched

### 2. E2E Test

**File: `apps/e2e/test/specs/tv/Scrape.e2e.ts`**

New test scenario: `"Failover to another TMDB asset server"`

**Step file: `apps/e2e/test/steps/debug-override-tmdb-asset-server-host.ts`**

Register step `debug override default tmdb asset server host is "xxx"`:

```ts
registerStep('debug override default tmdb asset server host is "xxx"', async (_ctx, args) => {
  const host = args[0]
  await browser.execute((h) => {
    localStorage.setItem('debug.overrideDefaultTmdbAssetServerHost', h)
  }, host)
})
```

Test flow:
1. Set `debug.overrideDefaultTmdbAssetServerHost = 'wronghost.tmdb.local'`
2. Import TMDB TV show folder (id 84666)
3. Trigger scrape
4. Verify all tasks complete (failover works through discover asset mirrors)

### Error Handling

- `localStorage.getItem` wrapped in try/catch — behaves as null on error
- `URL` constructor wrapped in try/catch — ignores invalid override host
- Returns null when `localStorage` is not available (SSR)

### Test Plan

- Run the new e2e test to verify scrape succeeds with overridden default host
- Run all existing Scrape tests to verify no regression from the production code change
- Run `pnpm --filter ui build` to verify no type errors
