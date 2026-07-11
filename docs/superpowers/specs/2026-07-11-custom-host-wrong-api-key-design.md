# Custom TMDB/TVDB Host — Wrong API Key 401 — Design Spec

> Decisions locked with the user on 2026-07-11.

## Goal

When the user configures a custom TMDB or TVDB host with an invalid API key,
`MediaDatabaseSearchbox` must surface the 401 status to the user with a friendly
localized message, and we add e2e tests (Cucumber) that verify this behavior
end-to-end.

## Current behavior

| Path | Error source | What the user sees |
|---|---|---|
| TMDB custom host | `fetchTmdb` returns `Response(status=401, ok=false)` | Generic `errors:searchFailed` ("Failed to search TMDB") — 401 is invisible |
| TVDB custom host | `TVDBv4.login()` throws `TVDBv4Error("TVDB login failed: 401 ...")` | `error.message` shown verbatim — 401 leaks in, but message is technical and not localized |

The SMM-managed default upstream is unaffected (no 401 path through the discover flow).

## Decisions

1. **New i18n key** `errors:searchFailedUnauthorized` with the same wording across
   all four locales. Message explicitly mentions "HTTP 401" and "API key" so the
   user can self-diagnose.
2. **Detection in `MediaDatabaseSearchbox.handleSearch`** — both TMDB and TVDB
   paths check for 401 and use the new key. No changes to `fetchTmdb` /
   `fetchTvdb` / `TVDBv4Error`.
3. **TVDB detection** uses the `status` field on `TVDBv4Error` (not string
   matching), so non-401 errors keep their existing technical messages.
4. **E2E coverage only** — no new unit tests. The 401 detection logic is small
   and exercised end-to-end; the existing `tvdb.test.ts` and
   `MediaDatabaseSearchbox.test.tsx` continue to cover the positive paths.
5. **Two new spec files** for the negative scenarios, separate from the existing
   positive specs. The wrong-key test does not need `TMDB_API_KEY` / `TVDB_API_KEY`
   env vars — it uses a hardcoded invalid key.

## i18n

New key: `errors:searchFailedUnauthorized`

| Locale | Value |
|---|---|
| en | `Search failed: invalid API key (HTTP 401). Please check your API key and host configuration.` |
| zh-CN | `搜索失败:API key 无效(HTTP 401)。请检查 API key 和主机配置。` |
| zh-HK | `搜尋失敗:API key 無效(HTTP 401)。請檢查 API key 和主機配置。` |
| zh-TW | `搜尋失敗:API key 無效(HTTP 401)。請檢查 API key 和主機配置。` |

`apps/ui/src/types/i18next.d.ts` — add `searchFailedUnauthorized: string` to
`ErrorsResources`.

## Code changes

### `apps/ui/src/components/MediaDatabaseSearchbox.tsx`

**TMDB path** (current `if (!resp || !resp.ok)` block around line 255):

```typescript
if (!resp || !resp.ok) {
  if (resp?.status === 401) {
    setSearchError(t("errors:searchFailedUnauthorized"))
    return
  }
  setSearchError(t("errors:searchFailed"))
  return
}
```

**TVDB path** — keep the success/no-results branch as-is. The 401 case is
caught in the existing `try/catch` block. Detect `TVDBv4Error` with
`status === 401`:

```typescript
} catch (error) {
  console.error("Search failed:", error)
  if (error instanceof TVDBv4Error && error.status === 401) {
    setSearchError(t("errors:searchFailedUnauthorized"))
  } else {
    setSearchError(
      error instanceof Error ? error.message : t("errors:searchFailed"),
    )
  }
  setSearchResults([])
  setTvdbSearchResultsRaw([])
}
```

Add the `TVDBv4Error` import from `@smm/tvdb4`.

### `apps/ui/src/components/ImmersiveSearchbox.tsx`

Add `data-testid="tmdb-search-error"` to the error `<div>` (around line 302)
so e2e tests can target it deterministically.

## E2E additions

### New step

`apps/e2e/test/steps/searchbox-shows-error-message-xxx.ts`:

```typescript
import { registerStep } from '../lib/gherkin'
import { expect } from '@wdio/globals'

registerStep('Searchbox shows error message "xxx"', async (_ctx, args) => {
  const [expectedText] = args
  const errorEl = await $('[data-testid="tmdb-search-error"]')
  await errorEl.waitForDisplayed({ timeout: 30000 })
  const text = await errorEl.getText()
  expect(text).toContain(expectedText)
})
```

Register it in `apps/e2e/test/steps/index.ts`.

### New specs

`apps/e2e/test/specs/manual/CustomTmdbHost-WrongApiKey.e2e.ts` — sets
`config.tmdb = { host: 'https://api.themoviedb.org/3', apiKey: 'invalid-wrong-key' }`,
runs the same G/W/W/Then flow as the positive spec, and asserts
`Searchbox shows error message "401"`.

`apps/e2e/test/specs/manual/CustomTvdbHost-WrongApiKey.e2e.ts` — same, with
`config.tvdb = { host: 'https://api4.thetvdb.com/v4', apiKey: 'invalid-wrong-key' }`
and an extra `I select "TVDB" as the search database` step.

Both specs:
- Keep the `isOfficialTmdbHostAccessible` / `isOfficialTvdbHostAccessible` guards
  — the 401 response still requires the host to be network-reachable; the guards
  verify reachability, not auth.
- Keep `isReverseProxyAccessible` because the request flows through the local
  SMM reverse proxy.
- Set `this.timeout(90 * 1000)`.

## Out of scope

- Other non-401 HTTP error codes (404, 500, etc.) — keep current behavior
  (generic `searchFailed`).
- Network/connection errors — keep current behavior (caught in fetchImpl's
  own try/catch).
- SMM-managed default upstream — never 401, unaffected.
- Pin-based TVDB auth (`TVDBv4.pin`) — orthogonal to API key; the 401 message
  is still accurate.

## Plan

`docs/superpowers/plans/2026-07-11-custom-host-wrong-api-key.md`
