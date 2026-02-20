## Why

The UI currently has a `DownloadVideoDialog` component that allows users to input a URL and download folder, but the actual download functionality is not connected to any backend API. The CLI already has yt-dlp integration with a `/api/ytdlp/download` endpoint. This change connects the UI dialog to the existing backend to enable actual video downloading capability.

## What Changes

1. **Add ytdlp API client** - Create `apps/ui/src/api/ytdlp.ts` with functions to call the CLI's yt-dlp endpoints
2. **Enable Download Video menu item** - Uncomment and wire up the "Download Video" menu item in `menu.tsx` to open the dialog
3. **Integrate dialog with API** - Connect the `DownloadVideoDialog` to call the ytdlp download API when user clicks Start

## Capabilities

### New Capabilities
- **video-download**: Enables downloading videos from URLs using yt-dlp directly from the SMM UI

### Modified Capabilities
- None

## Impact

- **Frontend**: New API client (`apps/ui/src/api/ytdlp.ts`), updated menu component
- **Backend**: No changes needed - existing `/api/ytdlp/download` endpoint already exists
- **Dependencies**: None - uses existing yt-dlp integration
