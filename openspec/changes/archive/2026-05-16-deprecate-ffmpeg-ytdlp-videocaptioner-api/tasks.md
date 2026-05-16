## 1. Shared client adapters

- [x] 1.1 Add `apps/ui/src/lib/whitelistedCmd/` with arg builders ported from CLI routes (`ytdlp` download, `videocaptioner` transcribe/translate/synthesize/process, `ffmpeg` convert/screenshots, `ffprobe` tags read/write)
- [x] 1.2 Add `executeCmdToCompletion` helper (stream drain, exit parsing, stderr excerpt, header correlation) with unit tests
- [x] 1.3 Add `probeWhitelistedCommand(command)` for tool availability (replace discover/version fetches)
- [x] 1.4 Add download stdout parser for output file path (port from `Download.ts`)

## 2. UI API layer migration

- [x] 2.1 Refactor `apps/ui/src/api/ytdlp.ts`: remove `downloadYtdlpVideo`, discover, version, extract-data route calls; use adapters (keep existing executeCmd probe paths)
- [x] 2.2 Refactor `apps/ui/src/api/ffmpeg.ts` to use executeCmd for convert, screenshots, tags, writeTags
- [x] 2.3 Refactor `apps/ui/src/api/videocaptioner.ts` to use executeCmd for transcribe; remove discover route
- [x] 2.4 Update `useVideoCaptionerStatus`, `useYtdlpMutations`, and callers (`MusicPanel`, `format-converter-dialog`, `TvShowEpisodeTable`, hooks)

## 3. Service Worker migration

- [x] 3.1 Migrate `startDownload` in `download-service-worker.js` to executeCmd download adapter (preserve `ytdlpFormat`, default args, abort)
- [x] 3.2 Migrate transcribe/translate/synthesize/process handlers to executeCmd + correlation headers
- [x] 3.3 Ensure SW can import or duplicate shared arg builders (adjust build if needed)

## 4. CLI route removal

- [x] 4.1 Unregister handlers in `apps/cli/server.ts` for `/api/ffmpeg/*`, `/api/ytdlp/*`, `/api/videocaptioner/*`
- [x] 4.2 Delete route modules under `apps/cli/src/route/ffmpeg`, `ytdlp`, `videocaptioner` (keep utils used by executeCmd)
- [x] 4.3 Remove or relocate tests that only cover deleted routes; keep `executeCmd` and utils tests green

## 5. Documentation and types

- [x] 5.1 Update `docs/api/index.md` and `ExecuteCmdAPI.md`; remove entries for deleted routes
- [x] 5.2 Update `apps/ui/src/types/background-jobs.ts` comments and any stale route strings in tests/mocks

## 6. Verification

- [x] 6.1 Update affected UI tests (`videocaptioner.test.ts`, `MusicPanel.test.tsx`, download dialog tests, etc.)
- [x] 6.2 Run `pnpm test:ui` and `pnpm test:cli`
- [ ] 6.3 Manual smoke: download video, transcribe, translate, synthesize, process, ffmpeg convert, command log dialog
