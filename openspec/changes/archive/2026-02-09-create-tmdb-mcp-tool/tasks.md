## 1. Internationalization Setup

- [x] 1.1 Add English tool descriptions to `cli/public/locales/en/tools.json`
  - Add description for `tmdb-search` tool
  - Add description for `tmdb-get-movie` tool
  - Add description for `tmdb-get-tv-show` tool

- [x] 1.2 Add Chinese tool descriptions to `cli/public/locales/zh-CN/tools.json`
  - Add Chinese translation for `tmdb-search` tool
  - Add Chinese translation for `tmdb-get-movie` tool
  - Add Chinese translation for `tmdb-get-tv-show` tool

## 2. TMDB Search Tool Implementation

- [x] 2.1 Create `cli/src/mcp/tools/tmdbSearchTool.ts`
  - Import `search` function from `@/route/Tmdb`
  - Import `getLocalizedToolDescription` from `@/i18n/helpers`
  - Define tool schema with keyword (required), type (required), language (optional), baseURL (optional) parameters
  - Implement tool handler that calls `search()` function and formats response
  - Export `getTool()` function that returns tool definition with localized description
  - Export `tmdbSearchAgentTool()` function for agent tool wrapper
  - Export `tmdbSearchMcpTool()` function for MCP tool registration
  - Export `registerTmdbSearchTool()` async function for MCP server registration

- [x] 2.2 Validate `tmdbSearchTool.ts` implementation
  - Verify tool accepts all required and optional parameters
  - Verify tool calls `search()` function correctly
  - Verify response format matches MCP standard with data/error fields
  - Verify i18n integration works with `getLocalizedToolDescription()`

## 3. TMDB Get Movie Tool Implementation

- [x] 3.1 Create `cli/src/mcp/tools/tmdbGetMovieTool.ts`
  - Import `getMovie` function from `@/route/Tmdb`
  - Import `getLocalizedToolDescription` from `@/i18n/helpers`
  - Define tool schema with id (required), language (optional), baseURL (optional) parameters
  - Implement tool handler that calls `getMovie()` function and formats response
  - Export `getTool()` function that returns tool definition with localized description
  - Export `tmdbGetMovieAgentTool()` function for agent tool wrapper
  - Export `tmdbGetMovieMcpTool()` function for MCP tool registration
  - Export `registerTmdbGetMovieTool()` async function for MCP server registration

- [x] 3.2 Validate `tmdbGetMovieTool.ts` implementation
  - Verify tool accepts all required and optional parameters
  - Verify tool calls `getMovie()` function correctly
  - Verify response format matches MCP standard with data/error fields
  - Verify i18n integration works with `getLocalizedToolDescription()`

## 4. TMDB Get TV Show Tool Implementation

- [x] 4.1 Create `cli/src/mcp/tools/tmdbGetTvShowTool.ts`
  - Import `getTvShow` function from `@/route/Tmdb`
  - Import `getLocalizedToolDescription` from `@/i18n/helpers`
  - Define tool schema with id (required), language (optional), baseURL (optional) parameters
  - Implement tool handler that calls `getTvShow()` function and formats response
  - Export `getTool()` function that returns tool definition with localized description
  - Export `tmdbGetTvShowAgentTool()` function for agent tool wrapper
  - Export `tmdbGetTvShowMcpTool()` function for MCP tool registration
  - Export `registerTmdbGetTvShowTool()` async function for MCP server registration

- [x] 4.2 Validate `tmdbGetTvShowTool.ts` implementation
  - Verify tool accepts all required and optional parameters
  - Verify tool calls `getTvShow()` function correctly
  - Verify response format matches MCP standard with data/error fields
  - Verify i18n integration works with `getLocalizedToolDescription()`

## 5. MCP Server Registration

- [x] 5.1 Import tool registration functions in `cli/src/mcp/mcp.ts`
  - Add import for `registerTmdbSearchTool`
  - Add import for `registerTmdbGetMovieTool`
  - Add import for `registerTmdbGetTvShowTool`

- [x] 5.2 Register TMDB tools in MCP server initialization
  - Call `await registerTmdbSearchTool(server)` after existing tool registrations
  - Call `await registerTmdbGetMovieTool(server)` after `registerTmdbSearchTool`
  - Call `await registerTmdbGetTvShowTool(server)` after `registerTmdbGetMovieTool`

## 6. Testing and Verification

- [x] 6.1 Test TMDB search tool
  - Start MCP server and verify `tmdb-search` tool appears in tool list
  - Invoke tool with valid movie keyword and verify results
  - Invoke tool with valid TV show keyword and verify results
  - Test with Chinese language parameter
  - Test error handling with missing keyword parameter
  - Test error handling with invalid type parameter

- [x] 6.2 Test TMDB get movie tool
  - Start MCP server and verify `tmdb-get-movie` tool appears in tool list
  - Invoke tool with valid movie ID (e.g., 27205 for Inception) and verify details
  - Test with Chinese language parameter
  - Test error handling with invalid movie ID
  - Test error handling with missing ID parameter

- [x] 6.3 Test TMDB get TV show tool
  - Start MCP server and verify `tmdb-get-tv-show` tool appears in tool list
  - Invoke tool with valid TV show ID (e.g., 1396 for Breaking Bad) and verify details with seasons/episodes
  - Verify all seasons are returned with complete episode lists
  - Test with Japanese language parameter
  - Test error handling with invalid TV show ID
  - Test error handling with missing ID parameter

- [x] 6.4 Verify i18n integration
  - Connect with English language preference and verify tool descriptions are in English
  - Connect with Chinese (Simplified) language preference and verify tool descriptions are in Chinese
  - Verify fallback to English for unsupported languages

- [x] 6.5 Verify code reuse
  - Confirm all tools import and use existing functions from `@/route/Tmdb`
  - Verify no duplication of TMDB API calling logic
  - Verify error handling relies on existing TMDB function error responses
