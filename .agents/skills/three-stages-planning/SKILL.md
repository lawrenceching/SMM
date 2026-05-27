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
2. **Create `docs/design/[change-name].md`** - Summary the changes in words, and create the design document with proper name.
3. **Ask Feedback** - Ask user for reivew, and adjust the design document accordingly.
   The message template
   ```
   The design document is created. Review its content and let me know if anything needs to adjust.
   Or say "approved" to move to coding stage.
   ```
4. **Start Coding** - If user approved the change, start coding following the "Tasks" section in design document.

## Design Document Template

```md
# [Change Name]

TODO: brief the change here.

## 1. Background
TODO: brief the background of this change here.

## 2. Architecture
TODO: High level architecture, represent by diagram

## 3. User Stories

### 3.1 User Story Title

[describe the user story in TDD style here]
* **Given** - 
* **When** - 
* **Then** - 

```mermaid
[draw the technical sequence diagram here]
```

## 4. Tasks

Break down the change into tasks in technical view.

### 4.1 New UI Component

[ ] Task 1...
[ ] Task 2...
[ ] ...

### 4.1 New HTTP interface

[ ] Task 1...
[ ] Task 2...
[ ] ...

## Backward Compatibility
TODO: think of potential backward compatibility issues. If no issues found, mark as `none`.

## Documents
TODO: list the documents that needs to update in this change
[ ] `docs/...` [brief the changes here...]

```
