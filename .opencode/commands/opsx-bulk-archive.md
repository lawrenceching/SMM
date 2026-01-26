---
description: Archive multiple completed OpenSpec changes at once
---

Archive multiple completed changes in a single operation.

This command allows you to batch-archive changes, handling spec conflicts intelligently by checking the codebase to determine what's actually implemented.

**Input**: None required (prompts for selection)

**Steps**

1. **Get active changes** - Run `openspec list --json`. If no active changes exist, inform user and stop.

2. **Prompt for change selection** - Ask the user to choose changes. Show each change with its schema. Include "All changes" option. Allow any number of selections. **IMPORTANT**: Do NOT auto-select. Always let the user choose.

3. **Batch validation** - For each selected change: (a) Run `openspec status --change "<name>" --json` for artifact status; (b) Read tasks.md and count complete vs incomplete; (c) Check `openspec/changes/<name>/specs/` for delta specs and requirement names.

4. **Detect spec conflicts** - Build a map of `capability -> [changes that touch it]`. A conflict exists when 2+ selected changes have delta specs for the same capability.

5. **Resolve conflicts** - For each conflict: read delta specs from each change; search codebase for implementation evidence; determine resolution (only one implemented → sync that one; both implemented → apply in chronological order; neither → skip sync, warn user). Record resolution.

6. **Show consolidated status table** - Display table with Change, Artifacts, Tasks, Specs, Conflicts, Status. For conflicts show resolution. For incomplete changes show warnings.

7. **Confirm batch operation** - Ask user to confirm: "Archive N changes?" with options like "Archive all N", "Archive only ready changes (skip incomplete)", "Cancel". If incomplete, make clear they'll be archived with warnings.

8. **Execute archive for each confirmed change** - For each: (a) Sync specs if delta specs exist (use opsx-sync approach; for conflicts apply in resolved order); (b) `mkdir -p openspec/changes/archive` and `mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>`; (c) Track outcome (Success/Failed/Skipped).

9. **Display summary** - Show "Bulk Archive Complete" with archived list, skipped list, spec sync summary, and any failures.

**Guardrails**
- Allow any number of changes (1+ is fine)
- Always prompt for selection, never auto-select
- Detect spec conflicts early and resolve by checking codebase
- When both changes are implemented, apply specs in chronological order
- Use single confirmation for entire batch
- Archive directory target uses current date: YYYY-MM-DD-<name>
- If archive target exists, fail that change but continue with others
