## Why

The media folder initialization process currently supports recognizing TV shows from NFO files (tvshow.nfo and episode NFO files), but lacks support for movie folders that contain NFO files. Movie NFO files are commonly used by media management tools like tinyMediaManager to store movie metadata including title, year, and TMDB ID. Without this capability, users with movie folders containing NFO files must rely on folder name matching or TMDB ID in folder name, even when the metadata is already available locally in the NFO file.

## What Changes

- Add `MovieNFO` interface to represent movie NFO file content with title, originalTitle, year, tmdbid, plot, outline, and runtime fields
- Add `parseMovieNfo` async function to parse movie NFO XML and extract metadata into MovieNFO object
- Implement `tryRecognizeMovieByNFO` function in recognizeMediaFolderByNFO.ts that:
  - Finds movie NFO files in folder root (any .nfo file except tvshow.nfo)
  - Reads and parses the NFO file to verify it contains `<movie>` element
  - Extracts required fields (title, year, tmdbid) and optional fields (plot, outline, runtime)
  - Builds TMDBMovie object from NFO content and returns updated UIMediaMetadata

## Capabilities

### New Capabilities
- `movie-nfo-recognition`: Enables recognizing movie folders by parsing local NFO files that contain `<movie>` element, extracting title, year, and TMDB ID to identify the movie without requiring external API calls

### Modified Capabilities
None. This is a new capability that adds movie NFO recognition to the media folder initialization process.

## Impact

- **New Code**: ui/src/lib/nfo.ts - Add MovieNFO interface and parseMovieNfo function
- **Modified Code**: ui/src/lib/recognizeMediaFolderByNFO.ts - Implement tryRecognizeMovieByNFO function
- **Dependencies**: None new - uses existing readFile API and DOMParser for XML parsing
- **Related Systems**: Media folder initialization flow in ui/src/lib/recognizeMediaFolder.ts (may need to integrate tryRecognizeMovieByNFO)
