## Context

**Current State:**
SMM's MCP interface has tools for recognizing episode video files (`begin-recognize-task`, `add-recognized-media-file`, `end-recognize-task`) and a how-to guide for renaming files (`how-to-rename-episode-video-files`). However, there's no how-to guide for the recognition workflow itself.

**Constraints:**
- Must follow existing MCP tool patterns (e.g., `how-to-rename-episode-video-files`)
- Tool description should use i18n localization like other tools
- No new dependencies allowed (uses existing infrastructure)
- Must integrate with existing MCP server registration in `cli/src/mcp/mcp.ts`

**Stakeholders:**
- AI assistants using SMM's MCP interface
- Users who need to recognize episode video files before renaming them

## Goals / Non-Goals

**Goals:**
- Provide clear instructions for the episode video file recognition workflow
- Follow established patterns for MCP tool implementation
- Support i18n localization for tool descriptions
- Return structured markdown content explaining the three-step recognition process

**Non-Goals:**
- Dynamic instruction generation (content will be static)
- Interactive guidance (read-only instructions)
- Multi-language instruction content (only tool description is localized, instructions in Chinese like existing how-to tool)
- Actual file recognition (this is a documentation tool, not functional)

## Decisions

### 1. Follow `how-to-rename-episode-video-files` Pattern

**Decision:** Implement the `how-to-recognize-episode-video-files` tool using the same structure as `how-to-rename-episode-video-files`.

**Rationale:**
- Proven pattern that works well in the codebase
- Consistent with existing documentation tools
- Already handles i18n localization correctly
- Developers are familiar with this pattern
- Content can be in Chinese (matching the existing how-to tool)

**Alternatives Considered:**
- Create a new pattern: Rejected due to inconsistency
- Return content from external file: Rejected because static string is simpler

### 2. Use Static Content in Chinese

**Decision:** Store instruction content as a static Chinese string in the tool file.

**Rationale:**
- Matches the existing `how-to-rename-episode-video-files` tool which uses Chinese content
- The target users (Chinese-speaking) are well-served
- Simple and straightforward
- No file I/O overhead
- Content can be version-controlled with the code

**Alternatives Considered:**
- Use English content: Rejected because existing how-to tool uses Chinese
- Localize instruction content: Rejected due to maintenance overhead (tool description is sufficient for i18n)
- Fetch from remote: Rejected due to network dependency

### 3. Three-Step Recognition Workflow

**Decision:** Instructions will explain the three-step recognition task workflow:
1. Begin recognition task (`begin-recognize-task`)
2. Add recognized files (`add-recognized-media-file`)
3. End recognition task (`end-recognize-task`)

**Rationale:**
- Matches the actual MCP tool implementation
- Clear, sequential process
- Easy for users to follow
- Consistent with existing task-based workflows in SMM

**Alternatives Considered:**
- Single-step process: Not accurate - recognition requires multiple steps
- Include metadata queries: Can be mentioned as prerequisites, not core workflow

## Risks / Trade-offs

**Risk:** Static Chinese content may not serve non-Chinese users.

→ **Acceptance**: Tool description is localized, so non-Chinese users will understand what the tool does. The actual instructions in Chinese are acceptable because the primary user base is Chinese-speaking.

**Risk:** Instructions may become outdated if the recognition workflow changes.

→ **Mitigation**: Add a comment in the code reminding developers to update the content when the recognition workflow changes. Keep instructions focused on the stable three-step pattern.

**Trade-off:** Static content is less flexible than dynamic generation.

→ **Acceptance**: Simplicity and reliability outweigh flexibility. The recognition workflow is stable and well-defined.

## Migration Plan

**Deployment Steps:**
1. Create new tool file `cli/src/tools/howToRecognizeEpisodeVideoFiles.ts`
2. Create MCP wrapper `cli/src/mcp/tools/howToRecognizeEpisodeVideoFilesTool.ts`
3. Add tool registration to `cli/src/mcp/mcp.ts`
4. Export tool in `cli/src/tools/index.ts`
5. Add i18n entries to `cli/public/locales/*/tools.json` (en, zh-CN)

**Rollback Strategy:**
- Remove tool registration from `cli/src/mcp/mcp.ts`
- Delete new files (`howToRecognizeEpisodeVideoFiles.ts`, `howToRecognizeEpisodeVideoFilesTool.ts`)
- Remove exports from `cli/src/tools/index.ts`

**No Data Migration:** This is a new feature with no existing data to migrate.

## Open Questions

**Q: Should the instructions include examples of recognized files?**

**A:** Yes, include a simple example showing the three-step workflow with sample season/episode numbers. This helps users understand the practical usage.

**Q: How detailed should the instructions be about prerequisites?**

**A:** Mention that users need to know which TV show they're recognizing and have access to the media folder, but keep it brief. Focus on the recognition workflow itself.

**Q: Should we include troubleshooting tips?**

**A:** Not in the initial version. Keep instructions focused on the happy path. If users encounter issues, they can ask the AI assistant for help.
