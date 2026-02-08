## Context

**Current State:**
SMM's MCP interface provides specialized tools like `how-to-rename-episode-video-files` that return focused documentation. However, there's no general-purpose tool for accessing SMM's overall README and documentation.

**Constraints:**
- Must follow existing MCP tool patterns (e.g., `how-to-rename-episode-video-files`)
- Tool description should use i18n localization like other tools
- No new dependencies allowed (uses existing infrastructure)
- Must integrate with existing MCP server registration in `cli/src/mcp/mcp.ts`

**Stakeholders:**
- AI assistants using SMM's MCP interface
- Users who need documentation context without leaving the AI conversation

## Goals / Non-Goals

**Goals:**
- Provide easy access to SMM's README documentation through MCP interface
- Follow established patterns for MCP tool implementation
- Support i18n localization for tool descriptions
- Return structured markdown content about SMM's capabilities

**Non-Goals:**
- Dynamic README generation (content will be static)
- Interactive documentation (read-only access)
- README editing capabilities
- Multi-language README content (only tool description is localized)

## Decisions

### 1. Follow `how-to-rename-episode-video-files` Pattern

**Decision:** Implement the `readme` tool using the same structure as `how-to-rename-episode-video-files`.

**Rationale:**
- Proven pattern that works well in the codebase
- Consistent with existing tools, making it easier to maintain
- Already handles i18n localization correctly
- Developers are familiar with this pattern

**Alternatives Considered:**
- Create a new pattern: Rejected due to inconsistency and added complexity
- Return content from actual README.md file: Rejected because it requires file I/O and adds complexity

### 2. Use Static Content String

**Decision:** Store README content as a static string in the tool file (`readmeContent` constant).

**Rationale:**
- Simple and straightforward
- No file I/O overhead
- Content can be version-controlled with the code
- Easy to update

**Alternatives Considered:**
- Read from README.md at runtime: Rejected due to added complexity and potential path issues
- Store in separate markdown file: Rejected because it adds another file to maintain
- Fetch from remote URL: Rejected due to network dependency and latency

### 3. i18n for Tool Description Only

**Decision:** Use `getLocalizedToolDescription` helper for the tool description, but keep README content in English.

**Rationale:**
- Tool descriptions are user-facing and benefit from localization
- README content is typically technical documentation where English is acceptable
- Consistent with how other tools handle i18n
- Keeps implementation simple

**Alternatives Considered:**
- Localize entire README content: Rejected due to maintenance overhead
- No i18n at all: Rejected because it breaks consistency with other tools

## Risks / Trade-offs

**Risk:** Static README content may become outdated if project changes.

→ **Mitigation:** Add a comment in the code reminding developers to update the content when major changes occur.

**Trade-off:** Static content is less flexible than dynamic generation.

→ **Acceptance:** Simplicity and reliability outweigh the flexibility benefit for this use case.

**Risk:** English-only README content may not serve non-English users.

→ **Acceptance:** Technical documentation is commonly in English; localizing tool description provides sufficient i18n coverage.

## Migration Plan

**Deployment Steps:**
1. Create new tool file `cli/src/tools/readme.ts`
2. Create MCP wrapper `cli/src/mcp/tools/readmeTool.ts`
3. Add tool registration to `cli/src/mcp/mcp.ts`
4. Export tool in `cli/src/tools/index.ts`
5. Add i18n entries to `cli/public/locales/*/tools.json` (en, zh-CN)

**Rollback Strategy:**
- Remove tool registration from `cli/src/mcp/mcp.ts`
- Delete new files (`readme.ts`, `readmeTool.ts`)
- Remove exports from `cli/src/tools/index.ts`

**No Data Migration:** This is a new feature with no existing data to migrate.

## Open Questions

**Q: Should the README content include screenshots or images?**

**A:** No - MCP tools return text/markdown only. Images would need to be hosted separately and referenced by URL, which adds complexity. Keep it text-only for simplicity.

**Q: How often should the README content be updated?**

**A:** The content should be reviewed and updated when:
- Major new features are added to SMM
- Architecture changes significantly
- New MCP tools are added
- Usage patterns change

**Q: Should we add parameters to filter README content (e.g., sections only)?**

**A:** Not in the initial implementation. Keep it simple first. If users request filtering capabilities, we can extend the tool later with optional parameters.
