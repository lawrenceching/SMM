## Context

Currently, the DownloadVideoDialog selects QuickJS as the default JS runtime for YouTube videos and passes `--js-runtimes quickjs:<path>` to yt-dlp. However, there is no upfront check that a QuickJS binary actually exists. If the bundled binary is missing or the user-configured path is invalid, the download fails with a yt-dlp error only at execution time.

The `fetchDiscoverExecutables` API already resolves QuickJS paths (configured + discovered), and `ExternalApplicationsSettings` uses it for display. We reuse the same discovery mechanism for the proactive check.

## Goals / Non-Goals

**Goals:**
- After Go click for YouTube URLs, check whether a QuickJS binary is discoverable
- If unavailable, show a clear Chinese error message and disable the Start button
- Re-check on each Go click (not just once on mount)

**Non-Goals:**
- Checking QuickJS for non-YouTube URLs
- Adding a UI preference to skip the check
- Modifying the download execution pipeline

## Decisions

**Decision 1: Use `fetchDiscoverExecutables().quickjs` for probing**

The existing `fetchDiscoverExecutables()` API already resolves `quickjs.configuredPath` and `quickjs.discoveredPath`. We call it in `handleGo` to check if either path is non-null. No new API endpoint needed.

**Decision 2: Check at Go-click time, not URL input time**

Per spec, format listing is triggered by Go/Enter. The QuickJS check piggybacks on this already-async flow. Checking earlier (on URL change) would add unnecessary latency to typing.

**Decision 3: Block Start button, not Go button**

The Go button must remain functional so users can re-try after fixing the issue. Only Start is disabled.

**Decision 4: New error state in form hook, not in listing mutation**

`useListFormatsMutation` handles the `--list-formats` call. The QuickJS check is a separate concern — it determines whether listing is even allowed. We add a `quickjsUnavailable` boolean to `use-download-video-form` that disables Start.

## Risks / Trade-offs

- [Risk] `fetchDiscoverExecutables` is called twice (once in ExternalApplicationsSettings, once in DVD) → Acceptable; the API is a lightweight in-process file check
- [Risk] QuickJS binary exists at Go time but is deleted before Start → yt-dlp will still fail with a clear error; the proactive check reduces but doesn't eliminate this race
