# Movie NFO Recognition

This capability enables recognizing movie folders by parsing local NFO files that contain `<movie>` element, extracting title, year, and TMDB ID to identify the movie without requiring external API calls.

## Parse movie NFO XML content

The system SHALL parse movie NFO XML files using DOMParser to extract movie metadata into a structured MovieNFO object with the following fields:
- title (string, required)
- originalTitle (string, optional)
- year (number, optional)
- tmdbid (string, optional)
- plot (string, optional)
- outline (string, optional)
- runtime (number, optional)

### Scenario: Parse valid movie NFO with required fields
- **WHEN** the system parses an NFO file containing `<movie><title>Test Movie</title><year>2024</year><tmdbid>123456</tmdbid></movie>`
- **THEN** the parser SHALL return a MovieNFO object with title: "Test Movie", year: 2024, tmdbid: "123456"

### Scenario: Parse movie NFO with all optional fields
- **WHEN** the system parses an NFO file containing title, originalTitle, year, tmdbid, plot, outline, and runtime elements
- **THEN** the parser SHALL return a MovieNFO object with all fields populated

### Scenario: Parse invalid XML
- **WHEN** the system parses an NFO file with malformed XML
- **THEN** the parser SHALL throw an error with "Failed to parse XML" message

### Scenario: Parse NFO without movie element
- **WHEN** the system parses an NFO file that does not contain a `<movie>` root element
- **THEN** the parser SHALL return undefined

## Find movie NFO files in folder

The system SHALL scan media folder files to find NFO files that could represent movie metadata.

### Scenario: Find single NFO file in folder root
- **WHEN** a folder contains files: ["movie.nfo", "movie.mp4"]
- **THEN** the system SHALL identify "movie.nfo" as a candidate movie NFO file

### Scenario: Exclude tvshow.nfo from movie candidates
- **WHEN** a folder contains files: ["movie.nfo", "tvshow.nfo", "episode1.nfo"]
- **THEN** the system SHALL identify only "movie.nfo" as a movie NFO candidate
- **AND** the system SHALL exclude "tvshow.nfo" and "episode1.nfo"

### Scenario: No NFO files in folder
- **WHEN** a folder contains no .nfo files
- **THEN** the system SHALL return undefined for movie NFO recognition

### Scenario: Case insensitive NFO file extension
- **WHEN** a folder contains "Movie.NFO" (uppercase extension)
- **THEN** the system SHALL recognize it as a valid NFO file

## Recognize movie from NFO file

The system SHALL extract metadata from movie NFO files and build a TMDBMovie object for media folder recognition.

### Scenario: Recognize movie with complete NFO metadata
- **WHEN** a movie NFO file contains title "Test Movie", year 2024, and tmdbid "123456"
- **THEN** the system SHALL build a TMDBMovie object with id: 123456, title: "Test Movie", original_title: "", overview: ""
- **AND** the system SHALL set release_date to "2024-01-01"
- **AND** the system SHALL return UIMediaMetadata with tmdbMovie and type: "movie-folder"

### Scenario: Fail recognition with missing required fields
- **WHEN** a movie NFO file is missing title, year, or tmdbid
- **THEN** the system SHALL log an error with missing field information
- **AND** the system SHALL return undefined

### Scenario: Fail recognition when NFO is not a movie file
- **WHEN** an NFO file exists but does not contain `<movie>` root element
- **THEN** the system SHALL return undefined
- **AND** the system SHALL log that the NFO file does not contain a movie element

### Scenario: Handle NFO read error gracefully
- **WHEN** reading an NFO file fails due to file system error
- **THEN** the system SHALL log the error
- **AND** the system SHALL return undefined

## Build TMDBMovie from movie NFO

The system SHALL construct a TMDBMovie object from parsed MovieNFO data for integration with the media metadata system.

### Scenario: Build TMDBMovie with required fields
- **WHEN** MovieNfo has title "Action Movie", year 2023, tmdbid "999999"
- **THEN** the system SHALL create TMDBMovie with:
  - id: 999999
  - title: "Action Movie"
  - original_title: ""
  - overview: ""
  - release_date: "2023-01-01"
  - All other required TMDBMovie fields with default values

### Scenario: Use plot or outline for overview
- **WHEN** MovieNfo has plot "Movie plot summary" but empty outline
- **THEN** the system SHALL use plot value for TMDBMovie overview
- **WHEN** MovieNfo has both plot and outline
- **THEN** the system SHALL use plot value for TMDBMovie overview

### Scenario: Handle missing optional fields
- **WHEN** MovieNfo is missing originalTitle, plot, outline, or runtime
- **THEN** the system SHALL use empty string for text fields
- **AND** the system SHALL omit runtime from TMDBMovie (not a field)
