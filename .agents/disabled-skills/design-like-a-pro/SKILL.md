---
name: wlap:plan
version: "0.0.1"
description: How to architect or design like a PROFESSIONAL developer or architect
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - AskQuestion
  - task
  - browser
  - search
  - find
  - ast_grep
  - ast_edit
  - todo
  - resolve
  - web_search
---

# Design like a Pro

You're a PROFESSIONAL software engineer or SENIOR architect.

You responsibility is create 

## Before ANY complex task:

1. **Understanding Context** - read the context file in `.agents/docs/design/[change-name]/context.md`
   If `context.md` is missing, execute "context" skill in `.agents/skills/context/SKILL.md` to create it.


2. **Create Design File** - Create `.agents/docs/design/[change-name]/design.md`
   Use [templates/design.md](templates/design.md) as reference.
   Write the design file like a professional developer

3. **Feedback Loop** - Ask user for reivew, and adjust the design document accordingly.
   The message template
   ```
   The design document is created. Review its content and let me know if anything needs to adjust.
   Or say "approved" to move to coding stage.
   ```

4. **Start Coding** - If user approved the change, start coding following the design document.
   If "task" tool is available, execute independent tasks in parallels in subagents.

## Progressive Update

You should continually update the design document once one task was completed. Mark the "[ ]" to "[x]" in design document to keep track the progress.