## 1. Update listYtdlpFormats API

- [x] 1.1 Change `listYtdlpFormats` in `apps/ui/src/api/ytdlp.ts` to use `-J` instead of `-F`
- [x] 1.2 Parse stdout via `parse()` from `apps/ui/src/api/ytdlp/parse.ts` and return `VideoMetadata`
- [x] 1.3 Update return type: remove `YtdlpListFormatsResult`, return `VideoMetadata`

## 2. Adapt format code utilities

- [x] 2.1 Update `buildFormatCodes()` in `apps/ui/src/lib/ytdlpFormatCodes.ts` to accept `Format[]` from `VideoMetadata.formats` instead of `YtdlpListFormatsResult`
- [x] 2.2 Verify grouping logic (audio-only, video-only, combined) works with `Format.acodec`/`Format.vcodec`

## 3. Update hooks and UI consumers

- [x] 3.1 Update `useListFormatsMutation` to hold `VideoMetadata | null` instead of `YtdlpListFormatsResult | null`
- [x] 3.2 Update `use-download-video-form.ts` to access formats via `VideoMetadata.formats`
- [x] 3.3 Update `DownloadVideoDialog` and child components to use the new types

## 4. Remove old parser

- [x] 4.1 Delete `apps/ui/src/lib/parseYtdlpListFormats.ts`
- [x] 4.2 Delete `apps/ui/src/lib/parseYtdlpListFormats.test.ts`
- [x] 4.3 Remove `YtdlpListFormatsResult` import/export from `apps/ui/src/api/ytdlp.ts`

## 5. Update tests

- [x] 5.1 Update `apps/ui/src/api/ytdlp.test.ts` to test the JSON-based format listing flow
- [x] 5.2 Update `apps/ui/src/components/dialogs/download-video-dialog.test.tsx` to use `VideoMetadata`-based mock data
- [x] 5.3 Verify all existing tests pass — 39/41 dialog tests pass (2 QuickJS failures pre-existing), all ytdlp/parse/formatPresets tests pass

## 6. Verification

- [ ] 6.1 Manually test: open DownloadVideoDialog, enter a YouTube/Bilibili URL, click "Go", verify formats populate correctly
- [ ] 6.2 Verify format code dropdown grouping (audio-only, video-only, combined) works as before
- [ ] 6.3 Verify supplementary format dropdown (audio+video pairing) works as before
- [ ] 6.4 Verify download with selected format code works end-to-end
