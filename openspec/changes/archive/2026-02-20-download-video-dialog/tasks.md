## 1. Backend API (Completed)

- [x] 1.1 Verify yt-dlp endpoints exist in CLI (`/api/ytdlp/discover`, `/api/ytdlp/version`, `/api/ytdlp/download`)

## 2. Frontend API Client

- [x] 2.1 Create `apps/ui/src/api/ytdlp.ts` with `downloadYtdlpVideo`, `discoverYtdlp`, `getYtdlpVersion` functions

## 3. UI Integration

- [x] 3.1 Enable Download Video menu item in `apps/ui/src/components/menu.tsx`
- [x] 3.2 Connect `DownloadVideoDialog` to call the ytdlp API on Start button click
- [x] 3.3 Handle success/error responses and show toast notifications

## 4. Testing

- [x] 4.1 Test the full download flow with a valid video URL
- [x] 4.2 Test error handling when yt-dlp is not found
- [x] 4.3 Test with invalid URL input
