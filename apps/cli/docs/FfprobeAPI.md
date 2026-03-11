# FFprobe API

## Overview

The FFprobe API provides endpoints to read and write media file metadata tags using ffprobe and ffmpeg command-line tools.

## Endpoints

### POST /api/ffprobe/readTags

Reads metadata tags from a media file.

#### Request

**Method**: `POST`

**URL**: `/api/ffprobe/readTags`

**Headers**:
- `Content-Type: application/json`

**Body**:
```json
{
  "path": "C:/Videos/sample.mp4"
}
```

**Parameters**:
- `path` (string, required): The absolute path to media file

#### Response

**Success Response** (200 OK):
```json
{
  "tags": {
    "title": "Sample Video",
    "artist": "Artist Name",
    "album": "Album Name",
    "date": "2024",
    "genre": "Pop",
    "comment": "This is a sample video",
    "track": "1"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "File not found: C:/Videos/sample.mp4"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "error": "Failed to process tags request"
}
```

#### Error Codes

- `path is required`: The `path` field is missing or empty in the request body
- `File not found: <path>`: The specified file does not exist
- `ffprobe executable not found`: ffprobe is not installed or not found in expected locations
- `invalid media file format`: The file is not a valid media file
- `request timed out`: The ffprobe command took too long to execute (30 second timeout)
- `ffprobe failed: <error message>`: ffprobe encountered an error while processing the file

### POST /api/ffprobe/writeTags

Writes metadata tags to a media file using ffmpeg.

#### Request

**Method**: `POST`

**URL**: `/api/ffprobe/writeTags`

**Headers**:
- `Content-Type: application/json`

**Body**:
```json
{
  "path": "C:/Videos/sample.mp4",
  "tags": {
    "title": "New Title",
    "artist": "New Artist",
    "album": "New Album",
    "date": "2024",
    "genre": "Rock"
  }
}
```

**Parameters**:
- `path` (string, required): The absolute path to media file
- `tags` (object, required): Key-value pairs of tags to write. Must contain at least one tag.

#### Response

**Success Response** (200 OK):
```json
{
  "success": true
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "File not found: C:/Videos/sample.mp4"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "tags must not be empty"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "error": "Failed to process write tags request"
}
```

#### Error Codes

- `path is required`: The `path` field is missing or empty in the request body
- `tags must not be empty`: The `tags` object is empty or missing
- `File not found: <path>`: The specified file does not exist
- `ffmpeg executable not found`: ffmpeg is not installed or not found in expected locations
- `permission denied to write file`: The user does not have write permission for the file
- `request timed out`: The ffmpeg command took too long to execute (60 second timeout)
- `ffmpeg failed: <error message>`: ffmpeg encountered an error while processing the file

#### Idempotency

The write operation is idempotent - calling the endpoint multiple times with the same tag values will produce the same result. The operation uses a temporary file and atomic rename to ensure data integrity.

### POST /api/ffprobe/tags (Deprecated)

**⚠️ This endpoint is deprecated. Please use `/api/ffprobe/readTags` instead.**

This endpoint is maintained for backward compatibility but will be removed in a future version.

#### Deprecation Warning

When using this endpoint, the response will include a `deprecationWarning` field:

```json
{
  "tags": { ... },
  "deprecationWarning": "This endpoint is deprecated. Use /api/ffprobe/readTags instead."
}
```

The server will also log a warning when this endpoint is called.

#### Migration Guide

To migrate from the deprecated endpoint:

**Old Code:**
```typescript
const result = await fetch('/api/ffprobe/tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: '/path/to/video.mp4' })
});
```

**New Code:**
```typescript
const result = await fetch('/api/ffprobe/readTags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: '/path/to/video.mp4' })
});
```

## Common Tags

The following tags are commonly found in media files:

- `title`: Title of media
- `artist`: Artist or creator name
- `album`: Album name
- `date`: Release date
- `genre`: Genre of media
- `comment`: Additional comments or description
- `track`: Track number
- `composer`: Composer name
- `copyright`: Copyright information
- `description`: Media description
- `synopsis`: Synopsis or summary

Note: The available tags depend on media file format and how it was created. Not all formats support all tag types.

## Usage Examples

### Using Frontend API - Read Tags

```typescript
import { getMediaTags } from '@/api/ffmpeg';

const result = await getMediaTags({
  path: 'C:/Videos/sample.mp4'
});

if (result.error) {
  console.error('Error:', result.error);
} else {
  console.log('Tags:', result.tags);
  console.log('Title:', result.tags?.title);
  console.log('Artist:', result.tags?.artist);
}
```

### Using Frontend API - Write Tags

```typescript
import { writeMediaTags } from '@/api/ffmpeg';

const result = await writeMediaTags({
  path: 'C:/Videos/sample.mp4',
  tags: {
    title: 'My Awesome Video',
    artist: 'My Name',
    album: 'My Album',
    date: '2024',
    genre: 'Documentary'
  }
});

if (result.success) {
  console.log('Tags written successfully');
} else {
  console.error('Error:', result.error);
}
```

### Using cURL - Read Tags

```bash
curl -X POST http://localhost:30000/api/ffprobe/readTags \
  -H "Content-Type: application/json" \
  -d '{"path": "C:/Videos/sample.mp4"}'
```

### Using cURL - Write Tags

```bash
curl -X POST http://localhost:30000/api/ffprobe/writeTags \
  -H "Content-Type: application/json" \
  -d '{
    "path": "C:/Videos/sample.mp4",
    "tags": {
      "title": "New Title",
      "artist": "New Artist"
    }
  }'
```

## Implementation Details

### Backend

**Read Tags**:
- **Route Handler**: `apps/cli/src/route/ffmpeg/Tags.ts`
- **Utility Function**: `apps/cli/src/utils/Ffmpeg.ts` - `getMediaTags()`
- **Discovery Function**: `apps/cli/src/utils/Ffmpeg.ts` - `discoverFfprobe()`

**Write Tags**:
- **Route Handler**: `apps/cli/src/route/ffmpeg/WriteTags.ts`
- **Utility Function**: `apps/cli/src/utils/Ffmpeg.ts` - `writeMediaTags()`
- **Discovery Function**: `apps/cli/src/utils/Ffmpeg.ts` - `discoverFfmpeg()`

### Frontend

- **API Client**: `apps/ui/src/api/ffmpeg.ts`
  - `getMediaTags()` - Read tags from media file
  - `writeMediaTags()` - Write tags to media file

### FFprobe Command

The read operation uses the following ffprobe command:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams "<file_path>"
```

The command outputs JSON data containing media information, including tags in the `format.tags` field.

### FFmpeg Command

The write operation uses the following ffmpeg command:

```bash
ffmpeg -i "<input_file>" -c copy -metadata "key1=value1" -metadata "key2=value2" -y "<temp_file>"
```

The operation uses a temporary file and atomic rename to ensure data integrity and prevent corruption if the operation is interrupted.

## Configuration

### FFprobe Location

The ffprobe executable is discovered in the following order:

1. Custom path from user config (`ffprobeExecutablePath`)
2. Bundled resources path (`SMM_RESOURCES_PATH/bin/ffmpeg/`)
3. Development project root (`bin/ffmpeg/`)
4. SMM installation data directory (`~/.local/share/SMM/bin/ffmpeg/`)

### FFmpeg Location

The ffmpeg executable is discovered in the following order:

1. Custom path from user config (`ffmpegExecutablePath`)
2. Bundled resources path (`SMM_RESOURCES_PATH/bin/ffmpeg/`)
3. Development project root (`bin/ffmpeg/`)
4. SMM installation data directory (`~/.local/share/SMM/bin/ffmpeg/`)

### Timeouts

- **Read operation**: 30-second timeout
- **Write operation**: 60-second timeout (allows more time for larger files)

## Security Considerations

### File Access

The API validates that files exist before processing operations. File paths are converted to platform-specific absolute paths to prevent directory traversal attacks.

### Input Validation

All inputs are validated using Zod schemas to ensure:
- Required fields are present
- Data types are correct
- Tags are not empty for write operations

### Idempotent Operations

Write operations are designed to be idempotent - multiple calls with the same values will produce consistent results. This is achieved through:
- Atomic file operations (temp file + rename)
- Proper cleanup of temporary files

## Testing

Unit tests are available in:

- `apps/cli/src/route/ffmpeg/Tags.test.ts` - Read tags tests
- `apps/cli/src/route/ffmpeg/WriteTags.test.ts` - Write tags tests

To run tests:

```bash
pnpm test:cli
```

## Backward Compatibility

The old `/api/ffprobe/tags` endpoint remains functional for backward compatibility but includes:
- Deprecation warning in response body
- Warning log on server side
- Recommendation to use `/api/ffprobe/readTags`

Clients should update to use the new endpoint at their earliest convenience.

## Related Documentation

- [FFmpeg API](./Ytdlp.md) - Video conversion and screenshots
- [Media Metadata API](./MediaMetadataAPI.md) - Media metadata management

## Changelog

### Version 2.0.0

- **Breaking Change**: Renamed `/api/ffprobe/tags` to `/api/ffprobe/readTags`
- **Added**: New `/api/ffprobe/writeTags` endpoint for writing metadata tags
- **Added**: Idempotent write operations with atomic file operations
- **Deprecated**: `/api/ffprobe/tags` endpoint (maintained for backward compatibility)
- **Added**: Deprecation warnings for old endpoint
