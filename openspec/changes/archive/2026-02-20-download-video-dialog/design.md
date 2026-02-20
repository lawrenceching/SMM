## Context

The SMM application has a `DownloadVideoDialog` component in the UI that allows users to input a video URL and download folder. The CLI backend already has yt-dlp integration with the following endpoints:
- `GET /api/ytdlp/discover` - Find yt-dlp binary
- `GET /api/ytdlp/version` - Get yt-dlp version  
- `POST /api/ytdlp/download` - Download video from URL

The UI dialog is currently not connected to any backend - clicking "Start" only logs to console. The goal is to wire up the existing components.

## Goals / Non-Goals

**Goals:**
- Create UI API client to call CLI yt-dlp endpoints
- Enable "Download Video" menu item to open the dialog
- Connect dialog's Start button to the download API
- Display download progress (basic implementation)

**Non-Goals:**
- Real-time progress updates during download (currently returns only final result)
- Download queue management
- yt-dlp configuration UI
- Video format/quality selection

## Decisions

1. **API Client Location**: Created `apps/ui/src/api/ytdlp.ts` following existing API patterns (e.g., `hello.ts`)

2. **Menu Integration**: Uncommented and updated the existing commented-out menu item in `menu.tsx` to call `openDownloadVideo()` from dialog provider

3. **Dialog-to-API Connection**: The `DownloadVideoDialog` receives an `onStart` callback. Need to update the component to call the ytdlp API when invoked (currently just invokes callback without API call)

4. **Response Handling**: Backend returns `{ success?: boolean, error?: string, path?: string }` - dialog should handle success/error states and show appropriate feedback

## Risks / Trade-offs

- **No Streaming Progress**: The current yt-dlp implementation returns only the final result. The progress bar in the dialog will stay at 0% until completion. → Consider adding Server-Sent Events (SSE) for progress updates in a future enhancement.
- **Download Blocking**: The download is synchronous from the UI perspective - user must wait for completion. → Dialog stays open during download; consider async pattern with background downloads later.
- **Error Handling**: If yt-dlp is not found, backend returns error. Need to display this in the UI. → Already handled by showing error in toast/UI.
