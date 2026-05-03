## 1. Mapping and dialog wiring

- [x] 1.1 Add a small helper (e.g. in `apps/ui/src/lib/` or next to panels) that maps `MediaMetadata.mediaFiles` to `TranscribeDialogRow[]` (`id`, display `path`, `status: pending`, optional `title`) using `mediaFolderPath` for relative paths
- [x] 1.2 Verify mapped paths work with existing `TranscribeDialog` / `transcribeFeedback` (POSIX → platform at API boundary)

## 2. TV show UI

- [x] 2.1 Extend `TvShowHeaderV2` with a **Transcribe** action (props: `onTranscribeClick`, `isTranscribeAvailable`, disable when no video rows or empty `mediaFiles`)
- [x] 2.2 In `TvShowPanel`, use `useVideoCaptionerStatus`, local state for `TranscribeDialog` open/close, build rows from current `mediaMetadata`, render `TranscribeDialog`

## 3. Movie UI

- [x] 3.1 Extend `MovieHeaderV2` with the same **Transcribe** action contract as TV header
- [x] 3.2 In `MoviePanel`, wire captioner availability, dialog state, rows from `mediaMetadata.mediaFiles`, render `TranscribeDialog`

## 4. i18n and tests

- [x] 4.1 Add or reuse translation keys for header **Transcribe** labels (`components` or `dialogs` namespace per project convention)
- [x] 4.2 Add or update unit tests for header + mapping helper; optional smoke test for dialog open with mock metadata

## 5. Spec apply (post-code)

- [x] 5.1 Run `pnpm --filter ui typecheck` and relevant `vitest` for touched files
