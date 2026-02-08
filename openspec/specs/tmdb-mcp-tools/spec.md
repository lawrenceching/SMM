## ADDED Requirements

### Requirement: TMDB search tool availability
The system SHALL provide an MCP tool named `tmdb-search` that allows AI agents to search The Movie Database (TMDB) for movies and TV shows by keyword.

#### Scenario: Tool registration
- **WHEN** the MCP server initializes
- **THEN** the `tmdb-search` tool SHALL be registered and available for AI agents to invoke
- **AND** the tool SHALL have a localized description in the user's configured language

#### Scenario: Tool discovery
- **WHEN** an AI agent lists available tools from the MCP server
- **THEN** the `tmdb-search` tool SHALL appear in the tool list
- **AND** the tool description SHALL clearly indicate it searches for movies and TV shows

### Requirement: TMDB search by keyword
The system SHALL accept search queries with a keyword parameter and return matching movies or TV shows from TMDB.

#### Scenario: Search for movies by keyword
- **WHEN** an AI agent invokes `tmdb-search` with `keyword="Inception"`, `type="movie"`, and `language="en-US"`
- **THEN** the system SHALL return a list of movies matching "Inception"
- **AND** each result SHALL include TMDB ID, title, release year, overview, and poster path
- **AND** the response SHALL NOT contain an error

#### Scenario: Search for TV shows by keyword
- **WHEN** an AI agent invokes `tmdb-search` with `keyword="Breaking Bad"`, `type="tv"`, and `language="en-US"`
- **THEN** the system SHALL return a list of TV shows matching "Breaking Bad"
- **AND** each result SHALL include TMDB ID, name, first air date, overview, and poster path
- **AND** the response SHALL NOT contain an error

#### Scenario: Search in Chinese language
- **WHEN** an AI agent invokes `tmdb-search` with `keyword="盗梦空间"`, `type="movie"`, and `language="zh-CN"`
- **THEN** the system SHALL search TMDB with Chinese language parameter
- **AND** results SHALL include Chinese titles and overviews where available
- **AND** the response SHALL NOT contain an error

### Requirement: TMDB search input validation
The system SHALL validate input parameters before executing the search request.

#### Scenario: Missing required keyword parameter
- **WHEN** an AI agent invokes `tmdb-search` without providing a `keyword` parameter
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the keyword parameter is required

#### Scenario: Invalid media type
- **WHEN** an AI agent invokes `tmdb-search` with `type` value other than "movie" or "tv"
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate valid type options are "movie" or "tv"

### Requirement: TMDB search error handling
The system SHALL handle errors from the TMDB API and return meaningful error messages to the AI agent.

#### Scenario: TMDB configuration not set
- **WHEN** an AI agent invokes `tmdb-search` and TMDB API key is not configured
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that TMDB configuration is required

#### Scenario: Network error contacting TMDB
- **WHEN** the TMDB API request fails due to network issues
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL include details about the network failure

#### Scenario: TMDB API returns error
- **WHEN** the TMDB API returns an error response (e.g., rate limit, server error)
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL include the TMDB API status and error details

#### Scenario: Empty search results
- **WHEN** an AI agent searches for a keyword that returns no results from TMDB
- **THEN** the system SHALL return an empty results array
- **AND** the response SHALL NOT contain an error
- **AND** total_results SHALL be 0

### Requirement: TMDB search optional parameters
The system SHALL support optional parameters for language and custom TMDB host URL.

#### Scenario: Search with default language
- **WHEN** an AI agent invokes `tmdb-search` without specifying `language` parameter
- **THEN** the system SHALL use the default language (en-US)
- **AND** results SHALL be in English

#### Scenario: Search with custom TMDB host
- **WHEN** an AI agent invokes `tmdb-search` with `baseURL` parameter pointing to a custom TMDB proxy host
- **THEN** the system SHALL send the search request to the custom host
- **AND** the request SHALL NOT include an API key parameter (custom hosts embed authentication)

### Requirement: TMDB get movie tool availability
The system SHALL provide an MCP tool named `tmdb-get-movie` that allows AI agents to retrieve detailed movie information from TMDB by TMDB ID.

#### Scenario: Tool registration
- **WHEN** the MCP server initializes
- **THEN** the `tmdb-get-movie` tool SHALL be registered and available for AI agents to invoke
- **AND** the tool SHALL have a localized description in the user's configured language

#### Scenario: Tool discovery
- **WHEN** an AI agent lists available tools from the MCP server
- **THEN** the `tmdb-get-movie` tool SHALL appear in the tool list
- **AND** the tool description SHALL clearly indicate it retrieves movie details by TMDB ID

### Requirement: TMDB get movie by ID
The system SHALL accept a TMDB movie ID and return detailed movie metadata.

#### Scenario: Get movie with valid ID
- **WHEN** an AI agent invokes `tmdb-get-movie` with `id=27205` (Inception) and `language="en-US"`
- **THEN** the system SHALL return detailed movie information
- **AND** the response SHALL include title, overview, release date, runtime, genres, poster path, backdrop path, vote average, and vote count
- **AND** the response SHALL NOT contain an error

#### Scenario: Get movie in Chinese
- **WHEN** an AI agent invokes `tmdb-get-movie` with `id=27205` and `language="zh-CN"`
- **THEN** the system SHALL return movie information with Chinese title and overview
- **AND** the response SHALL NOT contain an error

### Requirement: TMDB get movie input validation
The system SHALL validate the movie ID parameter before executing the request.

#### Scenario: Invalid movie ID
- **WHEN** an AI agent invokes `tmdb-get-movie` with `id` that is not a positive integer
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the movie ID is invalid

#### Scenario: Missing movie ID parameter
- **WHEN** an AI agent invokes `tmdb-get-movie` without providing an `id` parameter
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the id parameter is required

### Requirement: TMDB get movie error handling
The system SHALL handle errors when retrieving movie information from TMDB.

#### Scenario: Movie not found
- **WHEN** an AI agent invokes `tmdb-get-movie` with an `id` that does not exist in TMDB
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the movie was not found

#### Scenario: TMDB API error during movie retrieval
- **WHEN** the TMDB API returns an error while fetching movie details
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL include the TMDB API status and error details

### Requirement: TMDB get TV show tool availability
The system SHALL provide an MCP tool named `tmdb-get-tv-show` that allows AI agents to retrieve detailed TV show information from TMDB by TMDB ID, including all seasons and episodes.

#### Scenario: Tool registration
- **WHEN** the MCP server initializes
- **THEN** the `tmdb-get-tv-show` tool SHALL be registered and available for AI agents to invoke
- **AND** the tool SHALL have a localized description in the user's configured language

#### Scenario: Tool discovery
- **WHEN** an AI agent lists available tools from the MCP server
- **THEN** the `tmdb-get-tv-show` tool SHALL appear in the tool list
- **AND** the tool description SHALL clearly indicate it retrieves TV show details with seasons and episodes

### Requirement: TMDB get TV show by ID with full episode list
The system SHALL accept a TMDB TV show ID and return detailed TV show metadata including all seasons and episodes.

#### Scenario: Get TV show with valid ID
- **WHEN** an AI agent invokes `tmdb-get-tv-show` with `id=1396` (Breaking Bad) and `language="en-US"`
- **THEN** the system SHALL return detailed TV show information
- **AND** the response SHALL include name, overview, first air date, genres, poster path, backdrop path, vote average
- **AND** the response SHALL include a seasons array
- **AND** each season SHALL include an episodes array with episode details (episode number, name, overview, air date, runtime, still path)
- **AND** the response SHALL NOT contain an error

#### Scenario: Get TV show in Japanese
- **WHEN** an AI agent invokes `tmdb-get-tv-show` with `id=1396` and `language="ja-JP"`
- **THEN** the system SHALL return TV show information with Japanese title and overview where available
- **AND** the response SHALL NOT contain an error

#### Scenario: TV show with multiple seasons
- **WHEN** an AI agent invokes `tmdb-get-tv-show` for a TV show with multiple seasons (e.g., id=1396)
- **THEN** the system SHALL return all seasons including Season 0 (specials)
- **AND** each season SHALL contain its complete episode list
- **AND** the response SHALL NOT contain an error

### Requirement: TMDB get TV show input validation
The system SHALL validate the TV show ID parameter before executing the request.

#### Scenario: Invalid TV show ID
- **WHEN** an AI agent invokes `tmdb-get-tv-show` with `id` that is not a positive integer
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the TV show ID is invalid

#### Scenario: Missing TV show ID parameter
- **WHEN** an AI agent invokes `tmdb-get-tv-show` without providing an `id` parameter
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the id parameter is required

### Requirement: TMDB get TV show error handling
The system SHALL handle errors when retrieving TV show information from TMDB.

#### Scenario: TV show not found
- **WHEN** an AI agent invokes `tmdb-get-tv-show` with an `id` that does not exist in TMDB
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL indicate that the TV show was not found

#### Scenario: TMDB API error during TV show retrieval
- **WHEN** the TMDB API returns an error while fetching TV show details
- **THEN** the system SHALL return an error response
- **AND** the error message SHALL include the TMDB API status and error details

### Requirement: TMDB MCP tools reuse existing business logic
The system SHALL reuse existing TMDB functions from `cli/src/route/Tmdb.ts` without duplicating business logic.

#### Scenario: Search uses existing search function
- **WHEN** the `tmdb-search` MCP tool is invoked
- **THEN** the tool SHALL call the `search()` function from `cli/src/route/Tmdb.ts`
- **AND** SHALL NOT duplicate the search implementation

#### Scenario: Get movie uses existing getMovie function
- **WHEN** the `tmdb-get-movie` MCP tool is invoked
- **THEN** the tool SHALL call the `getMovie()` function from `cli/src/route/Tmdb.ts`
- **AND** SHALL NOT duplicate the getMovie implementation

#### Scenario: Get TV show uses existing getTvShow function
- **WHEN** the `tmdb-get-tv-show` MCP tool is invoked
- **THEN** the tool SHALL call the `getTvShow()` function from `cli/src/route/Tmdb.ts`
- **AND** SHALL NOT duplicate the getTvShow implementation

### Requirement: TMDB MCP tools internationalization
The system SHALL provide localized tool descriptions in English and Chinese (Simplified) following the existing i18n pattern.

#### Scenario: English tool descriptions
- **WHEN** an AI agent connects with English language preference
- **THEN** all TMDB MCP tool descriptions SHALL be in English
- **AND** descriptions SHALL be loaded from `cli/public/locales/en/tools.json`

#### Scenario: Chinese tool descriptions
- **WHEN** an AI agent connects with Chinese (Simplified) language preference
- **THEN** all TMDB MCP tool descriptions SHALL be in Chinese (Simplified)
- **AND** descriptions SHALL be loaded from `cli/public/locales/zh-CN/tools.json`

#### Scenario: Fallback to English
- **WHEN** an AI agent connects with a language that has no translation
- **THEN** the system SHALL fall back to English tool descriptions

### Requirement: TMDB MCP tools response format
The system SHALL return responses in a consistent format with `data` and `error` fields.

#### Scenario: Successful response format
- **WHEN** a TMDB MCP tool executes successfully
- **THEN** the response SHALL include a `data` field containing the TMDB response
- **AND** the `error` field SHALL be absent or null

#### Scenario: Error response format
- **WHEN** a TMDB MCP tool encounters an error
- **THEN** the response SHALL include an `error` field with a descriptive error message
- **AND** the `data` field SHALL be null or undefined

#### Scenario: Response content type
- **WHEN** a TMDB MCP tool returns a response
- **THEN** the response SHALL be wrapped in MCP text content format
- **AND** the data/error object SHALL be serialized as JSON
