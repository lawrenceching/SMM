## Context

Currently, `DownloadVideoDialog` fetches per-video format information via `yt-dlp --list-formats` (or `-F`). This command outputs a terminal-formatted table parsed by `parseYtdlpListFormats.ts` using regex. The parser is fragile — it must handle locale-specific column headers, varying table widths, and yt-dlp version differences.

The `yt-dlp -J` command produces the same format information (plus video metadata) as structured JSON. The types (`types.ts`) and parser (`parse.ts`) for this JSON output are already implemented in `apps/ui/src/api/ytdlp/`.

## Goals / Non-Goals

**Goals:**
- Replace `-F`/`--list-formats` with `-J` for fetching available formats
- Remove the regex-based `parseYtdlpListFormats.ts` parser
- Reuse the already-built `types.ts` and `parse.ts` for JSON parsing
- Keep the UI behavior identical — the same format code dropdown, grouping, and supplementary format selection

**Non-Goals:**
- Changing the format code UI or UX
- Changing the download flow or job storage format
- Adding metadata display (thumbnail, description, etc.) from `-J` output
- Modifying the preset system

## Decisions

**Decision 1: Switch from `-F` to `-J` in `listYtdlpFormats` API**

The `listYtdlpFormats` function in `apps/ui/src/api/ytdlp.ts` will use `-J` instead of `-F`. The return type changes from `YtdlpListFormatsResult` to `VideoMetadata`. The function retains support for `--cookies`, `--cookies-from-browser`, and `--js-runtimes` flags.

Rationale: `-J` includes all format data from `-F` plus metadata. The structured JSON eliminates parsing ambiguity.

**Decision 2: Remove `parseYtdlpListFormats.ts` entirely**

The `YtdlpListFormatsResult` type and `parseYtdlpListFormatsStdout` function are superseded by `Format`/`VideoMetadata` from `types.ts` and `parse()` from `parse.ts`. Removing the old parser avoids maintaining two format data paths.

Rationale: Keeping both would create confusion about which is "canonical." Clean cut avoids drift.

**Decision 3: Adapt `ytdlpFormatCodes.ts` to consume `Format[]` directly**

Currently `buildFormatCodes()` takes `YtdlpListFormatsResult`. It will take `Format[]` instead, sourced from `VideoMetadata.formats`. The grouping logic (audio-only, video-only, combined) stays the same since `Format` has the same `acodec`/`vcodec` fields.

**Decision 4: Keep `useListFormatsMutation` hook interface largely unchanged**

The hook will return `VideoMetadata | null` instead of `YtdlpListFormatsResult | null`. The `listFormats` trigger signature stays the same (`YtdlpListFormatsRequest`), but internally calls the updated `listYtdlpFormats`.

Rationale: Minimizing the hook interface changes reduces downstream churn in `DownloadVideoDialog`.

**Decision 5: `-J` may be slower than `-F` — acceptable trade-off**

`-J` dumps full video metadata (title, description, thumbnails, chapters, subtitles) in addition to formats. This produces more data than `-F`. However, for the UX flow (user clicks "Go", waits for formats to populate), the extra latency is negligible (typically < 2 seconds for a single video) and the reliability gain outweighs it.

## Risks / Trade-offs

- **Larger payload**: `-J` output is 10-50x larger than `-F` table output. Mitigated by: JSON is transmitted over local process stdout (not network), and the Go button already has a spinner/loading state.
- **`-J` sometimes selects a "best" format automatically**: When run without `-f`, `-J` includes `requested_downloads` which reflects yt-dlp's default format selection. We ignore this and only use `.formats` for the dropdown.
