---
name: three-stages-planning
version: "0.0.1"
description: How to process the changes in architecture-coding-testing three stages
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
---

# Three Stages Planning

## Before ANY complex task:

1. **Ask Questions** - Think about the changes and ask questions to clarify the requirements.
   Invoke the proper tools to ask questions. If no suitable tools avaiable, ask a quesiton in plain text, using follow template
   ```
   1. [Question here]
      * a. [Answer 1]
      * b. [Answer 2]
      * c. [Answer 3]
      * d. Others

   2. ...
   3. ...

   Answer the questions in format:
   1 a
   2 b
   3 a
   4 write your own answer if you like
   ```

   **IMPORTANT** You can invoke several rounds of Q&A until you fully clarify the requirement.

2. **Create `.agents/docs/design/[change-name].md`** - Summary the changes in words, and create the design document with proper name.
   Use [templates/design.md](templates/design.md) as reference.
3. **Ask Feedback** - Ask user for reivew, and adjust the design document accordingly.
   The message template
   ```
   The design document is created. Review its content and let me know if anything needs to adjust.
   Or say "approved" to move to coding stage.
   ```
4. **Start Coding** - If user approved the change, start coding following the "Tasks" section in design document.

## Progressive Update

You should continually update the design document once one task was completed. Mark the "[ ]" to "[x]" in design document to keep track the progress.