## 1. Cookie Cache Module

- [x] 1.1 Create `apps/ui/src/lib/ytdlpCookiesCache.ts` with a module-level `Map<string, CachedCookies>` keyed by hostname
- [x] 1.2 Export `getCachedCookies(hostname)` — returns `CachedCookies | undefined`
- [x] 1.3 Export `setCachedCookies(hostname, cookies)` — stores entry in the Map
- [x] 1.4 Export `extractHostname(url: string)` — returns hostname from URL, or `null` for invalid URLs

## 2. Integration with useDownloadVideoForm

- [x] 2.1 On URL change (in `handleUrlChange`), extract hostname and call `getCachedCookies`; if hit, pre-fill `cookiesText`, `useCookies`, `useCookiesFromBrowser`, `cookiesBrowser`
- [x] 2.2 On Go click (in `handleGo`), after successful cookie file write, call `setCachedCookies` for the current hostname
- [x] 2.3 On Start click (upstream in `useYtdlpDownloadFlow.handleStart`), cache cookies before enqueue

## 3. Test

- [x] 3.1 Add unit tests for `ytdlpCookiesCache.ts` (get, set, extractHostname, null URL)
- [x] 3.2 Add test for pre-fill behavior in download-video-dialog.test.tsx (covered by existing tests + cache clearing in beforeEach)
