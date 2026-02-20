## 1. Backend Implementation

- [x] 1.1 Create download function in `apps/cli/src/utils/Ytdlp.ts`
- [x] 1.2 Implement argument validation (only allow --write-thumbnail, --embed-thumbnail)
- [x] 1.3 Execute yt-dlp with validated arguments

## 2. HTTP API Endpoint

- [x] 2.1 Create `POST /api/ytdlp/download` endpoint in `apps/cli/src/route/ytdlp/Download.ts`
- [x] 2.2 Register route in `apps/cli/server.ts`

## 3. Documentation

- [x] 3.1 Update `docs/YtdlpAPI.md` with download endpoint documentation

## 4. Verification

- [x] 4.1 Test download with valid URL
- [x] 4.2 Test download with --write-thumbnail arg
- [x] 4.3 Test download with disallowed args returns 400
- [x] 4.4 Test missing URL returns 400
