# [Change Name]

[brief the change here.]

[Complete the checklist below]
[ ] New UI component - check this if new UI component added
[ ] New user config - check this if new user config introduced
[ ] Electron only - check this if new feature only work in Electron env.
[ ] User document - check this if this change requires to add/update/delete user documents in `docs` folder

## 1. Background
[brief the background of this change here.]

## 2. Project Level Architecture

[Describe the project level architecture(PA) change. If no changes required for PA, mark "none"]

## 3. App Level Architecture

[Describe the app level architecture(AA) change. If no changes required for PA, mark "none"]

## 4. User Stories

### 4.1 User Story Title

[describe the user story in TDD style here]
* **Given** - 
* **When** - 
* **Then** - 

```mermaid
[draw the technical sequence diagram here]
```

## 5. Tasks

[Break down the change into tasks in technical view.
Each task should be isolated as a unit in best-effort.
So we can execute some tasks in parallels.]

### 5.1 New UI Component

[ ] Task 1...
[ ] Task 2...
[ ] ...

### 5.1 New HTTP interface

[ ] Task 1...
[ ] Task 2...
[ ] ...

## 6. Backward Compatibility
TODO: think of potential backward compatibility issues. If no issues found, mark as `none`.

## 7. Documents

TODO: list the documents that needs to update in this change.

[ ] `docs/design.md` [brief the changes here...]
[ ] `docs/api.md` [brief the changes here...]
[ ] `docs/user-guide.md` [brief the changes here...]
[ ] ...

## 8. Post Verification

[ ] Unit tests
    Run `pnpm run test` and expect all unit tests suceeded
[ ] Build
    Run `pnpm run build` and expect build succeeded