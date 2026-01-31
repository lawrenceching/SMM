## Context

The media folder initialization process recognizes TV shows from NFO files (tvshow.nfo and episode NFO files) via `tryToRecognizeMediaFolderByNFO` in TvShowPanelUtils.ts. Movie folders with NFO files are not recognized because there's no corresponding movie NFO parsing logic. Movie NFO files follow the same XML structure as tvshow.nfo but use `<movie>` as the root element instead of `<tvshow>`.

## Goals / Non-Goals

**Goals:**
- Enable recognizing movie folders by parsing local NFO files containing `<movie>` element
- Extract movie metadata (title, year, TMDB ID) from NFO files to build TMDBMovie objects
- Follow existing patterns from TV show NFO recognition for consistency

**Non-Goals:**
- Writing NFO files (read-only recognition)
- Complex NFO parsing beyond title, year, tmdbid, plot, outline, runtime
- Integration with the media folder initialization flow (left to follow-up work)
- Supporting all NFO formats from all media servers (focus on common tinyMediaManager format)

## Decisions

### 1. Parse movie NFO files with DOMParser in browser environment

**Decision:** Use browser's built-in DOMParser API for XML parsing instead of server-side XML parsing.

**Rationale:**
- The UI module runs in browser context where DOMParser is available
- Follows existing pattern from parseEpisodeNfo function in nfo.ts
- Avoids introducing external XML parsing dependencies

### 2. MovieNFO interface with minimal required fields

**Decision:** Define MovieNFO interface with title, originalTitle, year, tmdbid as core fields, plus optional plot, outline, runtime.

**Rationale:**
- Title and year are essential for movie identification
- TMDB ID enables future API lookups for additional metadata
- Optional fields provide enhanced metadata when available
- Mirrors the TV show Nfo class structure for consistency

### 3. NFO file discovery: any .nfo file except tvshow.nfo

**Decision:** Find movie NFO files by scanning for any .nfo file in folder root that is not tvshow.nfo.

**Rationale:**
- Movie folders typically have one NFO file named after the movie
- Excluding tvshow.nfo avoids conflicts with TV show recognition
- Mirrors the design in media-folder-initialization.md specification

### 4. Validate required fields before building TMDBMovie

**Decision:** Require title, year, and tmdbid fields to be present and non-empty.

**Rationale:**
- Ensures meaningful movie identification
- Allows graceful fallback to other recognition methods if NFO is incomplete
- Follows existing pattern from tryToRecognizeMediaFolderByNFO

## Risks / Trade-offs

- **Risk:** NFO format variations across different media managers (Kodi, Plex, Emby)

  **Mitigation:** Focus on common tinyMediaManager format used in test files. The parser handles optional fields gracefully.

- **Risk:** Non-movie NFO files (e.g., season NFO files) could be misidentified

  **Mitigation:** Only accept files with `<movie>` root element. parseMovieNfo returns undefined if no movie element found.

- **Risk:** Duplicate recognition with other methods (TMDB ID in folder name, folder name matching)

  **Mitigation:** The media folder initialization flow determines recognition order. Movie NFO is likely checked before other methods.

## Open Questions

1. Should the function handle NFO files with `uniqueid type="tmdb"` as fallback for TMDB ID?
2. Should the recognition be case-insensitive for file extensions (.NFO vs .nfo)?
