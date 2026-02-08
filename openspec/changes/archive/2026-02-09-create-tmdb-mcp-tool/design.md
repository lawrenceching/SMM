## Context

### Current State
SMM's CLI module has TMDB integration implemented in `cli/src/route/Tmdb.ts` with three core functions:
- **`search()`**: Searches TMDB for movies/TV shows by keyword, type, and language
- **`getMovie()`**: Retrieves detailed movie metadata by TMDB ID
- **`getTvShow()`**: Retrieves detailed TV show metadata with all seasons and episodes by TMDB ID

These functions are currently exposed only via HTTP REST API endpoints (`/api/tmdb/search`, `/api/tmdb/movie/:id`, `/api/tmdb/tv/:id`) and handle:
- TMDB API configuration (host, API key, proxy settings from user config)
- Language mapping (zh-CN, en-US, ja-JP)
- Error handling and HTTP request execution
- Support for both official TMDB API and custom proxy hosts

### MCP Infrastructure
The MCP server (`cli/src/mcp/mcp.ts`) follows a consistent pattern for tool registration:
1. Each tool is implemented in its own file under `cli/src/mcp/tools/`
2. Tools export `registerXxxTool()` function that registers the tool with the MCP server
3. Tools support i18n via `getLocalizedToolDescription()` helper
4. Registration functions are async to support localized descriptions
5. Tools are registered in sequence in the main MCP server setup

### Constraints
- Must reuse existing TMDB business logic from `Tmdb.ts` - no duplication of API calls
- Must follow existing MCP tool patterns for consistency
- Must support i18n for tool descriptions
- Cannot modify existing MCP tools or HTTP API endpoints
- TMDB functions may return errors (config issues, network failures, invalid IDs)

## Goals / Non-Goals

**Goals:**
- Expose TMDB search and metadata retrieval as MCP tools for AI agents
- Reuse 100% of existing TMDB business logic (zero duplication)
- Follow established MCP tool patterns in the codebase
- Support internationalization for tool descriptions
- Maintain error handling consistency with existing tools

**Non-Goals:**
- Modifying existing TMDB HTTP API behavior
- Adding new TMDB API endpoints
- Changing how TMDB configuration is stored/managed
- Implementing new TMDB features beyond what's already in `Tmdb.ts`
- Modifying existing MCP tools

## Decisions

### 1. Tool Structure: Three Separate MCP Tools
**Decision**: Create 3 distinct MCP tools rather than a single tool with an action parameter.

**Rationale**:
- Aligns with existing REST API structure (3 separate endpoints)
- Each tool has a distinct purpose and input schema
- Follows MCP best practices of one tool per action
- Makes tool discovery more intuitive for AI agents

**Alternatives Considered**:
- **Single tool with action parameter**: Rejected because it would require complex input validation and makes the tool's purpose less clear

### 2. Code Organization: Separate Tool Files
**Decision**: Create one file per tool in `cli/src/mcp/tools/`:
- `tmdbSearchTool.ts`
- `tmdbGetMovieTool.ts`
- `tmdbGetTvShowTool.ts`

**Rationale**:
- Follows existing pattern (e.g., `getMediaFoldersTool.ts`, `listFilesTool.ts`)
- Each tool is independently testable and maintainable
- Easy to add/remove tools individually
- Matches the project's file organization conventions

**Alternatives Considered**:
- **Single file for all TMDB tools**: Rejected because it would deviate from existing patterns and reduce modularity

### 3. Code Reuse: Direct Import and Function Calls
**Decision**: Import TMDB functions directly from `cli/src/route/Tmdb.ts` and call them.

**Rationale**:
- Functions are already well-tested in the HTTP API context
- Zero code duplication ensures single source of truth
- Any improvements to TMDB functions automatically benefit both HTTP API and MCP tools
- Error handling is already robust

**Implementation Pattern**:
```typescript
import { search, getMovie, getTvShow } from '@/route/Tmdb';

// In MCP tool handler:
const result = await search({ keyword, type, language });
// Map result to MCP tool response format
```

**Alternatives Considered**:
- **Extract to shared service module**: Rejected as unnecessary - the functions are already in a shared route module
- **Copy/paste logic**: Rejected due to duplication and maintenance burden

### 4. Input Schema Design: Match TMDB Function Signatures
**Decision**: MCP tool input schemas directly mirror the parameters of TMDB functions.

**Rationale**:
- `search()`: `{ keyword: string, type: 'movie' | 'tv', language?: string, baseURL?: string }`
- `getMovie()`: `{ id: number, language?: string, baseURL?: string }`
- `getTvShow()`: `{ id: number, language?: string, baseURL?: string }`
- Maintains 1:1 mapping between tool inputs and function parameters
- Reduces transformation logic and potential bugs
- Makes the code predictable and easy to understand

### 5. Response Format: Consistent with Existing MCP Tools
**Decision**: Return structured responses with `data` and `error` fields.

**Rationale**:
- TMDB functions already return `{ data, error }` format
- Maintains consistency with existing MCP tools in the project
- Makes error handling uniform across all tools
- Follows the project's API design guideline

**Response Structure**:
```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify({
      data: <TMDB response data>,
      error: <error message if any>
    })
  }]
}
```

### 6. Internationalization: Use Existing i18n Infrastructure
**Decision**: Add tool descriptions to `cli/public/locales/{lng}/tools.json` using existing i18n helpers.

**Rationale**:
- Infrastructure already exists (`getLocalizedToolDescription()`)
- Supported in English and Chinese (zh-CN)
- Zero additional setup required
- Consistent with all other MCP tools

**Implementation**:
```typescript
// cli/public/locales/en/tools.json
{
  "tmdb-search": {
    "description": "Search TMDB (The Movie Database) for movies or TV shows by keyword. Returns matching results with title, release year, overview, and TMDB ID."
  },
  "tmdb-get-movie": {
    "description": "Retrieve detailed movie information from TMDB by TMDB ID. Includes title, overview, release date, runtime, genres, poster images, and more."
  },
  "tmdb-get-tv-show": {
    "description": "Retrieve detailed TV show information from TMDB by TMDB ID, including all seasons and episodes with their titles, overviews, air dates, and more."
  }
}
```

### 7. Error Handling: Preserve TMDB Function Error Messages
**Decision**: Pass through error messages from TMDB functions without modification.

**Rationale**:
- TMDB functions already provide detailed, context-specific error messages
- Errors cover: missing config, network failures, invalid IDs, API errors
- No need to re-format or add additional error handling
- Keeps the MCP tool a thin wrapper around proven logic

## Risks / Trade-offs

### Risk 1: Configuration Dependency
**Risk**: MCP tools require proper TMDB configuration (API key, host) to function. Without config, all tools will fail.

**Mitigation**:
- TMDB functions already handle missing config gracefully with clear error messages
- Error messages guide users to configure TMDB settings
- This is expected behavior - same as HTTP API endpoints

### Risk 2: Large Response Sizes
**Risk**: `getTvShow()` can return very large responses (TV shows with many seasons/episodes). This might exceed context limits or cause performance issues.

**Mitigation**:
- This is already a known constraint in the HTTP API
- Users can filter/limit results by requesting specific seasons if needed
- The existing behavior is acceptable for HTTP API, so it should be acceptable for MCP
- Consider adding pagination in future enhancements if needed

### Risk 3: Network Latency
**Risk**: TMDB API calls introduce network latency, which might slow down AI agent workflows.

**Mitigation**:
- This is unavoidable when querying external APIs
- Existing HTTP API has the same limitation
- Users can configure a faster/proxy TMDB host if needed
- No additional overhead introduced by MCP wrapper

### Trade-off: Parameter Flexibility vs. Simplicity
**Trade-off**: We're exposing all parameters from TMDB functions (language, baseURL) which makes tools more flexible but also more complex.

**Decision**: Keep all parameters because:
- Existing HTTP API exposes these parameters
- Users may need to search in different languages or use custom TMDB hosts
- The complexity is minimal and well-documented
- Provides maximum flexibility without added implementation cost

## Migration Plan

### Deployment Steps
1. Create the three tool files in `cli/src/mcp/tools/`
2. Add tool descriptions to i18n files (en, zh-CN)
3. Register tools in `cli/src/mcp/mcp.ts`
4. Test MCP tools with AI agents to verify functionality
5. No database migrations or configuration changes required

### Rollback Strategy
- Remove tool registrations from `cli/src/mcp/mcp.ts`
- Delete tool files from `cli/src/mcp/tools/`
- Remove tool descriptions from i18n files
- Zero data migration needed - tools are stateless

### Testing Strategy
- Use existing TMDB function tests (already cover business logic)
- Test MCP tool registration and invocation
- Verify error handling with missing config
- Verify i18n works in multiple languages
- Test with real AI agent queries

## Open Questions

None - the design is straightforward and reuses proven existing functionality.
