## Context

The DownloadVideoDialog currently requires users to manually paste cookies or select a browser each time the dialog opens. For repeated downloads from the same site (especially YouTube), this is friction. Cookies are valid for weeks/months, so re-entering them per session is unnecessary.

## Goals / Non-Goals

**Goals:**
- Cache cookie text and browser selection by domain in memory
- Auto-fill cookies on URL change when a cached entry matches the domain
- Cache is session-only, lost on page refresh (no persistence)

**Non-Goals:**
- Persisting cookies to disk or localStorage (security risk)
- Cross-domain cookie sharing
- Expiry/validation of cached cookies (if they're stale, yt-dlp will report an error)

## Decisions

### D1: Plain `Map<string, CachedCookies>` for the cache

Use a module-level `Map` keyed by domain name. No library needed — the cache is simple key-value storage.

**Rationale:** A `Map` provides O(1) lookup, is iterable, and has no persistence overhead. The cache lives in the module's closure, shared across all hook instances.

### D2: Cache key = URL hostname

Extract domain via `new URL(url).hostname`. For YouTube this gives `www.youtube.com`; for Bilibili `www.bilibili.com`. The full hostname is specific enough to avoid cross-domain leaks.

**Rationale:** `hostname` is unambiguous and available from the standard URL API. No regex or custom parsing needed.

### D3: Cache write on Go + Start, cache read on URL change

Write to cache when the user explicitly acts (clicks Go or Start) with non-empty cookies configured. Read from cache when the URL changes (pre-fill).

**Rationale:** Writing on explicit user action ensures only intentionally-configured cookies are cached. Reading on URL change provides immediate pre-fill feedback.

### D4: Cache both manual cookie text and browser selection

The cache entry stores `cookiesText`, `useCookies`, `useCookiesFromBrowser`, and `cookiesBrowser`. All four fields are restored together.

**Rationale:** If a user configured both manual cookies and browser cookies for YouTube, restoring only the text would lose the browser selection.

## Risks / Trade-offs

- **Stale cookies in cache cause yt-dlp errors:** Cached cookies may expire. Mitigation: the existing error handling (cookie expiry detection) already guides the user to reconfigure. The user can clear and re-paste.
- **Cache key collision for different YouTube channels under same domain:** All youtube.com cookies share one cache entry. Mitigation: this matches the actual cookie scope — cookies are domain-scoped in yt-dlp.
