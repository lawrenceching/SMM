---
name: debug-e2e-test
version: "0.0.1"
description: How to debug the e2e test failure
user-invocable: true
disable-model-invocation: true
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
---

# Debug e2e test

1. **Create Document** - Draft the bug document using [template](./template.md) in `.agents/docs/bug/[brief-the-bug].md`
2. **Fill Document Accurately** - Understand the codebase and update "Code Path" section with accurate description. This is the key part for debugging.
3. **Start Debugging** - Move the document status from "draft" to "wip". Analyze the suspicious one by one, and update their status to "proved" or "rejected" accordingly.
   If information is not enough, add logs, reproduce the bug, collect new logs to help debugging.
4. **Fix** - If suspicious was proved, propose the solution, update the bug document , and ask use to review and approved. Apply the fix ONLY WHEN user is approved
5. **Wrap Up** - Update bug document to "done" status, suspicious to "fixed" status

