# New File Name API

Generate a new file name based on a rename rule.

## POST /api/newFileName

Generate a new file name using a specified naming rule.

```typescript
interface NewFileNameRequestBody {
    /**
     * The name of the rename rule to use
     * Currently only "plex" is supported
     */
    ruleName: "plex";
    
    /**
     * Type of media: "tv" for TV shows or "movie" for movies
     */
    type: "tv" | "movie";
    
    /**
     * Season number (for TV shows, typically starts from 1)
     */
    seasonNumber: number;
    
    /**
     * Episode number (for TV shows, typically starts from 1)
     */
    episodeNumber: number;
    
    /**
     * Name of the episode or movie
     */
    episodeName: string;
    
    /**
     * Name of the TV show (for TV shows)
     */
    tvshowName: string;
    
    /**
     * Original file path (used to extract file extension)
     */
    file: string;
    
    /**
     * TMDB ID of the media
     */
    tmdbId: string;
    
    /**
     * Release year of the media
     */
    releaseYear: string;
}

interface GetFileNameResponseBody {
    /**
     * The generated file name (relative path)
     */
    data: string;
    
    /**
     * Error message if the request failed
     */
    error?: string;
}
```

### Example Request (TV Show)

```json
{
  "ruleName": "plex",
  "type": "tv",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "episodeName": "Pilot",
  "tvshowName": "Example Show",
  "file": "/path/to/episode.mp4",
  "tmdbId": "12345",
  "releaseYear": "2023"
}
```

### Example Response (TV Show)

```json
{
  "data": "Season 01/Example Show - S01E01 - Pilot.mp4"
}
```

### Example cURL Request (TV Show)

```bash
curl -X POST http://localhost:30000/api/newFileName \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "plex",
    "type": "tv",
    "seasonNumber": 1,
    "episodeNumber": 1,
    "episodeName": "Pilot",
    "tvshowName": "Example Show",
    "file": "/path/to/episode.mp4",
    "tmdbId": "12345",
    "releaseYear": "2023"
  }'
```

### Example Request (Movie)

```json
{
  "ruleName": "plex",
  "type": "movie",
  "seasonNumber": 0,
  "episodeNumber": 0,
  "episodeName": "Example Movie",
  "tvshowName": "",
  "file": "/path/to/movie.mp4",
  "tmdbId": "67890",
  "releaseYear": "2023"
}
```

### Example Response (Movie)

```json
{
  "data": "Example Movie (2023).mp4"
}
```

### Error Responses

If validation fails:
```json
{
  "data": "",
  "error": "Validation Failed: ruleName must be \"plex\", type must be \"tv\" or \"movie\""
}
```

If an unsupported rule name is provided:
```json
{
  "data": "",
  "error": "Unsupported Rule: ruleName \"custom\" is not supported"
}
```

If file name generation fails:
```json
{
  "data": "",
  "error": "Generation Failed: Error executing rename rule code..."
}
```

