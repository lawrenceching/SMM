## Why

Users downloading multiple videos from the same site must paste or re-configure cookies each time the dialog opens. Since cookies don't change between sessions, caching them in memory by domain eliminates repetitive manual entry while keeping sensitive data out of persistent storage.

## What Changes

- Add an in-memory cookie cache keyed by domain name (e.g., `youtube.com`, `bilibili.com`)
- When the user configures cookies and clicks Go or Start, cache the cookies for that domain
- When the dialog opens with a new URL, check the cache for matching domain and pre-fill cookies
- Cache is session-only (cleared on page refresh); no disk persistence

## Capabilities

### New Capabilities

- `in-memory-cookies-cache`: In-memory, domain-keyed cache for yt-dlp Netscape-format cookie text. Covers cache write (on Go/Start), cache read (on URL change / dialog open), and cache key extraction from video URLs.

### Modified Capabilities

- `download-video-dialog-cookies`: Cookies section SHALL auto-fill from cache when a cached domain matches the URL; SHALL update the cache when the user confirms (Go or Start) with non-empty cookies.

## Impact

- `useDownloadVideoForm` hook: cache read on URL change, cache write in handleGo/handleStart
- `CookiesSection`: no visual changes needed (pre-fill happens via existing state)
- New module: `lib/ytdlpCookiesCache.ts` (in-memory Map, domain extraction)
- No new dependencies
