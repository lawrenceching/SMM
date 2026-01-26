---
description: Sync delta specs from a change to main specs
---

Sync delta specs from a change to main specs.

This is an **agent-driven** operation - you will read delta specs and directly edit main specs to apply the changes. This allows intelligent merging (e.g., adding a scenario without copying the entire requirement).

**Input**: Optionally specify a change name (e.g., `add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Ask the user to select.
   Show changes that have delta specs (under `specs/` directory).
   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Find delta specs**

   Look for delta spec files in `openspec/changes/<name>/specs/*/spec.md`.

   Each delta spec file contains sections like:
   - `## ADDED Requirements` - New requirements to add
   - `## MODIFIED Requirements` - Changes to existing requirements
   - `## REMOVED Requirements` - Requirements to remove
   - `## RENAMED Requirements` - Requirements to rename (FROM:/TO: format)

   If no delta specs found, inform user and stop.

3. **For each delta spec, apply changes to main specs**

   For each capability with a delta spec at `openspec/changes/<name>/specs/<capability>/spec.md`:

   a. Read the delta spec to understand the intended changes
   b. Read the main spec at `openspec/specs/<capability>/spec.md` (may not exist yet)
   c. **Apply changes intelligently:**
      - **ADDED:** If requirement doesn't exist in main spec → add it. If already exists → update to match.
      - **MODIFIED:** Find the requirement in main spec, apply the changes (new scenarios, modified scenarios, changed description). Preserve content not mentioned in the delta.
      - **REMOVED:** Remove the entire requirement block from main spec
      - **RENAMED:** Find the FROM requirement, rename to TO
   d. **Create new main spec** if capability doesn't exist yet: Create `openspec/specs/<capability>/spec.md`, add Purpose section (brief, TBD ok), add Requirements section with ADDED requirements.

4. **Show summary**

   After applying all changes, summarize:
   - Which capabilities were updated
   - What changes were made (requirements added/modified/removed/renamed)

**Key Principle: Intelligent Merging**

Unlike programmatic merging, you can apply **partial updates**: to add a scenario, just include that scenario under MODIFIED—don't copy existing scenarios. The delta represents *intent*, not a wholesale replacement.

**Guardrails**
- Read both delta and main specs before making changes
- Preserve existing content not mentioned in delta
- If something is unclear, ask for clarification
- Show what you're changing as you go
- The operation should be idempotent - running twice should give same result
