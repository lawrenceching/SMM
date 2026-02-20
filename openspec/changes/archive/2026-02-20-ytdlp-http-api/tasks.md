## 1. Backend Implementation

- [x] 1.1 Create Ytdlp utility in `apps/cli/src/utils/Ytdlp.ts`
- [x] 1.2 Implement `discoverYtdlp()` function with path discovery logic
- [x] 1.3 Implement `getYtdlpVersion()` function to execute yt-dlp --version

## 2. HTTP API Endpoints

- [x] 2.1 Create `GET /api/ytdlp/discover` endpoint in `apps/cli/src/route/ytdlp/Discover.ts`
- [x] 2.2 Create `GET /api/ytdlp/version` endpoint in `apps/cli/src/route/ytdlp/Version.ts`
- [x] 2.3 Register routes in `apps/cli/server.ts`

## 3. Documentation

- [x] 3.1 Update `docs/YtdlpAPI.md` with discover endpoint documentation
- [x] 3.2 Add version endpoint documentation to `docs/YtdlpAPI.md`

## 4. Verification

- [x] 4.1 Test `GET /api/ytdlp/discover` returns correct path
- [x] 4.2 Test `GET /api/ytdlp/version` returns version string (returns error when execution fails)
- [x] 4.3 Test error handling when yt-dlp not found
