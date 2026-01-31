## 1. Add MovieNFO type and parser to nfo.ts

- [x] 1.1 Add MovieNFO interface with title, originalTitle, year, tmdbid, plot, outline, runtime fields
- [x] 1.2 Implement parseMovieNfo async function that parses XML and returns MovieNFO | undefined
- [x] 1.3 Add error handling for malformed XML (throws "Failed to parse XML")
- [x] 1.4 Add handling for NFO files without <movie> element (returns undefined)
- [x] 1.5 Parse numeric fields (year, runtime) with NaN validation
- [x] 1.6 Test parseMovieNfo with the example NFO file at test/media/夺命小丑2_高清/夺命小丑2 (2025).nfo

## 2. Implement tryRecognizeMovieByNFO function

- [x] 2.1 Add required imports (Path, readFile, parseMovieNfo, TMDBMovie)
- [x] 2.2 Implement NFO file discovery (find .nfo files except tvshow.nfo)
- [x] 2.3 Add file reading logic with error handling
- [x] 2.4 Add MovieNFO parsing with required field validation
- [x] 2.5 Implement TMDBMovie object construction from MovieNFO
- [x] 2.6 Set UIMediaMetadata.tmdbMovie and type to 'movie-folder'
- [x] 2.7 Add logging for successful recognition and errors
- [x] 2.8 Handle AbortSignal for cancellation

## 3. Integration (optional, follow-up)

- [x] 3.1 Add tryRecognizeMovieByNFO to media folder initialization flow in recognizeMediaFolder.ts
- [x] 3.2 Determine recognition order (movie NFO before TMDB ID in folder name)
- [x] 3.3 Add unit tests for tryRecognizeMovieByNFO
