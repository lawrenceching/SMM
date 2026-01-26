---
description: Verify implementation matches change artifacts before archiving
---

Verify that an implementation matches the change artifacts (specs, tasks, design).

**Input**: Optionally specify a change name (e.g., `add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Ask the user to select.
   Show changes that have implementation tasks (tasks artifact exists).
   Include the schema used for each change if available.
   Mark changes with incomplete tasks as "(In Progress)".
   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand: `schemaName`, which artifacts exist for this change.

3. **Get the change directory and load artifacts**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```
   This returns the change directory and context files. Read all available artifacts from `contextFiles`.

4. **Verify Completeness**

   **Task Completion:** If tasks.md exists, parse checkboxes. Count complete vs total. If incomplete tasks exist, add CRITICAL issue for each.

   **Spec Coverage:** If delta specs exist in `openspec/changes/<name>/specs/`, extract all requirements. For each requirement, search codebase for implementation evidence. If requirements appear unimplemented, add CRITICAL issue.

5. **Verify Correctness**

   **Requirement Implementation:** For each requirement, search codebase, assess if implementation matches intent. If divergence detected, add WARNING.

   **Scenario Coverage:** For each scenario in delta specs, check if conditions are handled and if tests exist. If uncovered, add WARNING.

6. **Verify Coherence**

   **Design Adherence:** If design.md exists, extract key decisions. Verify implementation follows them. If contradiction detected, add WARNING.

   **Code Pattern Consistency:** Review new code for consistency with project patterns. If significant deviations, add SUGGESTION.

7. **Generate Verification Report**

   **Summary Scorecard:** Completeness (X/Y tasks, N reqs), Correctness (M/N reqs covered), Coherence (Followed/Issues).

   **Issues by Priority:** CRITICAL (must fix before archive), WARNING (should fix), SUGGESTION (nice to fix). Each with specific, actionable recommendation.

   **Final Assessment:**
   - If CRITICAL issues: "X critical issue(s) found. Fix before archiving."
   - If only warnings: "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."
   - If all clear: "All checks passed. Ready for archive."

**Graceful Degradation**
- If only tasks.md exists: verify task completion only
- If tasks + specs exist: verify completeness and correctness
- If full artifacts: verify all three dimensions
- Always note which checks were skipped and why

**Output:** Use clear markdown with table for summary, grouped lists for issues, code references as `file.ts:123`, and specific actionable recommendations.
