## Why

`yt-dlp --list-formats` outputs an unstructured terminal table that the current regex-based parser (`parseYtdlpListFormats.ts`) struggles to parse reliably. `yt-dlp -J` outputs the same format data as structured JSON alongside video metadata, eliminating the parsing fragility entirely.

## What Changes

- Replace `yt-dlp -F/--list-formats` with `yt-dlp -J` for fetching per-video format information
- Reuse the existing `types.ts` data model and `parse.ts` parser already created in `apps/ui/src/api/ytdlp/`
- Remove `parseYtdlpListFormats.ts` and its `YtdlpListFormatsResult` type — the structured JSON types (`Format`, `VideoMetadata`) supersede them
- Update `useListFormatsMutation` hook to return `VideoMetadata` instead of `YtdlpListFormatsResult`
- Update `DownloadVideoDialog` and `ytdlpFormatCodes.ts` to consume formats from `VideoMetadata.formats` instead of the parsed `--list-formats` output
- Update `listYtdlpFormats` API function to use `-J` instead of `-F`
- **BREAKING**: The `YtdlpListFormatsResult` type and `parseYtdlpListFormatsStdout` export are removed

## Capabilities

### New Capabilities

- `ytdlp-json-format-listing`: Use `yt-dlp -J` command to get video metadata including available formats in structured JSON, replacing the `--list-formats` table-parsing approach

### Modified Capabilities

- `download-video-dialog-formats`: Update scenarios to reference `-J` instead of `--list-formats`; format codes are sourced from `VideoMetadata.formats`
- `download-video-format-listing`: Replace `--list-formats` references with `-J`; format code mode is populated from the JSON `formats` array
- `video-format-code-selection`: Update to source format codes from `VideoMetadata.formats` instead of `--list-formats` output

## Impact

- `apps/ui/src/api/ytdlp.ts` — `listYtdlpFormats` switches from `-F` to `-J`, returns `VideoMetadata`
- `apps/ui/src/api/ytdlp/parse.ts` — already implemented, handles JSON parsing
- `apps/ui/src/api/ytdlp/types.ts` — already implemented, provides `Format` and `VideoMetadata` interfaces
- `apps/ui/src/lib/parseYtdlpListFormats.ts` — **removed**
- `apps/ui/src/lib/parseYtdlpListFormats.test.ts` — **removed**
- `apps/ui/src/lib/ytdlpFormatCodes.ts` — adapt to consume `Format[]` directly instead of `YtdlpListFormatsResult`
- `apps/ui/src/components/dialogs/hooks/useListFormatsMutation.ts` — return type changes
- `apps/ui/src/components/dialogs/hooks/use-download-video-form.ts` — downstream consumer updates
