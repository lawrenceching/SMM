## 1. Types & Constants

- [x] 1.1 Create `YtdlpJsRuntimeId` type and runtime definitions (Deno, Node.js, Bun, QuickJS) in `apps/ui/src/lib/ytdlpJsRuntimes.ts`
- [x] 1.2 Add `YtdlpFormatCode` type with format code entry, category (`audio-only` | `video-only` | `combined`), and parse function from `--list-formats` output
- [x] 1.3 Update `YTDLP_COOKIES_BROWSER_IDS` to support platform-aware filtering; export `getCookiesBrowserIds(platform: string)` function

## 2. Go Button & Format Listing

- [x] 2.1 Create `useListFormatsMutation` hook that calls `--list-formats` via IPC and returns parsed format data, loading state, and error state
- [x] 2.2 Add "Go" button to `UrlInputSection` (or create new GoButtonSection) with spinner icon during loading
- [x] 2.3 Wire Enter key in URL input to trigger the same action as "Go" button
- [x] 2.4 Remove URL blur auto-trigger from `useDownloadVideoForm`

## 3. Cookies Changes

- [x] 3.1 Add `platform` prop to `CookiesSection` and filter browser dropdown based on platform (Windows: Firefox only; macOS/Linux: Chrome, Edge, Firefox)
- [x] 3.2 Disable "Go" button for YouTube when neither cookie option is checked (both "使用 Cookies" and "从浏览器获取" unchecked)
- [x] 3.3 After successful `--list-formats`, move Cookies section from top-level layout into More Options section
- [x] 3.4 Add `showCookiesAtTopLevel` state to control Cookies section position

## 4. JS Runtime Selection

- [x] 4.1 Add "JS运行时" checkbox and runtime dropdown to `MoreOptionsSection`
- [x] 4.2 Force-enable checkbox and hide uncheck option when URL is YouTube
- [x] 4.3 Default runtime selection to QuickJS with path to bundled binary
- [x] 4.4 Pass `--js-runtimes` argument to yt-dlp command when JS Runtime is enabled (via `downloadVideoJobFactory` format string)

## 5. Format Code Selection

- [x] 5.1 Add format radio group ("预设" / "格式码") to `FormatSection` (visible only after successful format listing)
- [x] 5.2 Create format code dropdown component with 3-category grouping (audio only, video only, audio+video)
- [x] 5.3 Implement supplementary format dropdown when audio-only or video-only format is selected
- [x] 5.4 Format code selection produces `ytdlpFormat` string (single ID or `video_id+audio_id`)
- [x] 5.5 Hide format radio group and format code dropdowns when episodes or collection download is active

## 6. Error Handling

- [x] 6.1 Unify error detection logic to parse both `--list-formats` stderr and download stderr for known patterns (see `ytdlpErrorDetection.ts`)
- [x] 6.2 Display "Cookies 过期或无效, 请重新配置" when cookie expiry pattern is detected
- [x] 6.3 Display "请求格式不可用, 请尝试选择格式码" when format unavailable pattern is detected
- [x] 6.4 Display "未知错误, 请从状态栏任务列表中查看详细日志" for unrecognized errors

## 7. QuickJS CI & Packaging

- [x] 7.1 Add QuickJS download logic to `ci/download-3pp-binary.sh` for all 5 platforms
- [x] 7.2 Extract QuickJS flat into `bin/quickjs/` (no versioned subdirectory)
- [x] 7.3 Add `bin/quickjs` to `extraResources` in `apps/electron/electron-builder.yml` for win, mac, linux
- [ ] 7.4 Verify QuickJS binary is accessible at runtime via `<resourcesPath>/bin/quickjs/qjs` (requires build — deferred to build verification)

## 8. Integration & Cleanup

- [x] 8.1 Update `UIDownloadVideoDialogContent` props to include new states (platform, formats, format mode, js runtime, loading)
- [x] 8.2 Update `useDownloadVideoForm` to manage new state (format mode, js runtime, platform)
- [x] 8.3 Update `useYtdlpDownloadFlow` to include format listing mutation and format code data
- [x] 8.4 Update story files to reflect new props and states
- [x] 8.5 Remove backward-compatibility code paths if any (SMM is not yet published)
