## Context

The current MCP (Model Context Protocol) implementation in SMM has inconsistent tool registration patterns. Some tools like `calculate` and `get-media-folders` follow a modular pattern where each tool file exports a registration function (`registerCalculateTool`, `registerGetMediaFoldersTool`), while the majority of tools have their registration logic embedded directly in `cli/src/mcp/mcp.ts`. This creates several maintainability issues:

1. **Scattered Registration Logic**: Tool registration is split between `mcp.ts` (main server file) and individual tool files, making it difficult to understand the complete picture of available tools.

2. **Mixed Responsibilities**: `mcp.ts` contains both server configuration and individual tool definitions, violating the single responsibility principle.

3. **Difficult Maintenance**: Adding, modifying, or removing a tool requires changes in multiple locations, increasing the risk of errors.

4. **Inconsistent Testing**: Some tools have isolated registration tests while others don't, creating uneven test coverage.

5. **Poor Scalability**: As new tools are added, `mcp.ts` continues to grow in size and complexity.

The codebase already has a reference pattern established in `calculateTool.ts` and `getMediaFoldersTool.ts` that demonstrates the desired approach. The refactoring will apply this pattern consistently across all 14 tool files.

**Constraints:**
- Must maintain backward compatibility with existing MCP clients
- Cannot change tool names or their public API contracts
- Must work with both HTTP transport (`mcp.ts`) and stdio transport (`mcp/index.ts`)
- All existing tests must continue to pass

**Stakeholders:**
- Developers maintaining MCP tools
- Users relying on MCP integration with AI assistants
- Contributors adding new tools in the future

## Goals / Non-Goals

**Goals:**
1. **Consistent Registration Pattern**: Every tool file exports a `registerXxxTool(server: McpServer)` function
2. **Separation of Concerns**: Server configuration is separate from tool definitions
3. **Improved Maintainability**: Changes to a tool are contained within its own file
4. **Better Testability**: Each tool's registration can be tested independently
5. **Discoverability**: New developers can find tool definitions in the tool files themselves
6. **Extensibility**: Enable future features like dynamic tool discovery and plugin-based loading

**Non-Goals:**
1. **Changing Tool Behavior**: This is a refactoring to improve code organization, not to change functionality
2. **Adding New Tools**: No new MCP tools will be added in this change
3. **Modifying API Contracts**: Tool names, parameters, and responses remain unchanged
4. **Database or Schema Changes**: No data model changes required
5. **UI Changes**: No user interface modifications

## Decisions

### Decision 1: Registration Function Pattern

**Choice:** Each tool file exports a `registerXxxTool(server: McpServer): void` function that handles all registration for that tool.

**Rationale:**
- Follows the existing pattern already established by `registerCalculateTool` and `registerGetMediaFoldersTool`
- Clear, single responsibility per file
- Easy to test in isolation
- Simple to import and call from server initialization code
- Enables future dynamic registration if needed

**Alternative Considered - Registry Pattern:**
Create a central registry object where tools register themselves. Rejected because it introduces additional complexity and makes static analysis harder.

### Decision 2: Tool File Structure

**Choice:** Each tool file contains:
1. Handler function(s) for the tool logic
2. Parameters interface (if applicable)
3. Registration function that calls `server.registerTool()`

**Rationale:**
- Keeps related code together
- Reduces file count while maintaining organization
- Follows convention over configuration
- Familiar pattern from other MCP implementations

**Example Structure:**
```typescript
// Parameters interface
export interface XxxParams { ... }

// Handler function
export async function handleXxx(params: XxxParams): Promise<McpToolResponse> { ... }

// Registration function
export function registerXxxTool(server: McpServer): void {
  server.registerTool("tool-name", { ... }, async (args) => handleXxx(args));
}
```

### Decision 3: Registration in mcp.ts

**Choice:** `mcp.ts` imports and calls registration functions in a clearly organized manner.

**Rationale:**
- Centralizes tool registration in one location
- Easy to see which tools are active
- Simplifies tool enable/disable by commenting out import/call
- Maintains chronological order for debugging

**Implementation Pattern:**
```typescript
// Import registration functions
import { registerCalculateTool } from "./tools/calculateTool";
import { registerGetMediaFoldersTool } from "./getMediaFoldersTool";
// ... other imports

// In server initialization
registerCalculateTool(server);
registerGetMediaFoldersTool(server);
```

### Decision 4: Handling Tools with Multiple Operations

**Choice:** Tools with multiple operations (like `begin/add/end-rename-task`) have a single registration function that registers all related tools.

**Rationale:**
- Related tools stay together
- Reduces import count
- Logical grouping by feature
- Consistent with existing patterns

### Decision 5: Export Strategy

**Choice:** Update `tools/index.ts` to export both handler functions and registration functions.

**Rationale:**
- Maintains backward compatibility for existing imports
- Centralized exports make imports cleaner
- Single file controls public API surface

## Risks / Trade-offs

### Risk: Regression in Tool Registration
**Likelihood:** Medium
**Impact:** High

**Description:** Incorrectly refactored tools may fail to register, causing them to be unavailable to MCP clients.

**Mitigation:**
- All tool files already have working handler functions
- Registration follows established patterns
- Unit tests for handler functions continue to work
- Add integration test to verify all tools are registered
- Manual verification after implementation

### Risk: Breaking Existing MCP Clients
**Likelihood:** Low
**Impact:** High

**Description:** If tool names, parameters, or responses change, existing MCP clients may break.

**Mitigation:**
- This is a refactoring change only
- No changes to tool names, parameters, or response formats
- All existing tests continue to pass
- Verification that registration produces identical MCP manifests

### Risk: Increased File Count
**Likelihood:** N/A
**Impact:** Low

**Description:** Adding registration functions increases code slightly per file.

**Mitigation:**
- Pattern is already established, so additional code is minimal
- Improved maintainability offsets the slight increase
- Consistent structure aids understanding

### Risk: Circular Dependencies
**Likelihood:** Low
**Impact:** Medium

**Description:** If tools depend on each other, the registration pattern could create circular dependencies.

**Mitigation:**
- Tool handlers are already designed to be independent
- Registration functions only depend on McpServer from SDK
- No shared state between tools

### Trade-off: Development Time vs. Long-term Maintainability
**Trade-off:** Short-term development time to refactor vs. long-term easier maintenance.

**Decision:** Accept the short-term cost for long-term benefits. The refactoring enables faster future development and reduces bug risk.

## Migration Plan

### Phase 1: Preparation
1. Review all existing tool files to understand current patterns
2. Create registration function template to guide implementation
3. Verify existing tests pass before starting

### Phase 2: Implementation
1. Add registration functions to each tool file
2. Update `mcp.ts` to use registration functions
3. Update `tools/index.ts` exports
4. Update `mcp/index.ts` if stdio server needs updates

### Phase 3: Verification
1. Run all existing unit tests
2. Verify MCP server starts correctly
3. Verify tool list matches expected set
4. Manual testing of a few tools

### Phase 4: Cleanup
1. Remove any commented-out registration code from `mcp.ts`
2. Update documentation if needed
3. Commit changes

**Rollback Strategy:**
- Git revert to previous commit if issues arise
- No database or schema changes to revert
- Tool handlers remain unchanged, only registration moves

## Open Questions

1. **Should tools with multiple operations use separate registration functions?**
   - Current pattern uses one function per tool file
   - Tools like `begin/add/end-rename-task` could have separate registrations
   - Decision: Keep single function per file for consistency

2. **Should we add tool categorization/grouping in the registration?**
   - MCP supports tool grouping via naming conventions
   - Could help with tool discovery
   - Decision: Out of scope for this refactoring, can be added later

3. **Should we generate the tool registration code from a declarative config?**
   - Would reduce boilerplate further
   - More complex setup
   - Decision: Out of scope for this refactoring
