---
name: test-like-a-pro
version: "0.0.1"
description: How to write automation test like a professional developer
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

# Test like a Pro

## Steps

1. **Understanding** - Have thorough understanding, read `.agents/docs/architecture.md` first. And read docments in `.agents/docs/design/` folder that may relative to this test.

2. **Ask Questions** - Think about the changes and ask questions to clarify the test scenario.
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

3. **Software Architecture** Draw a diagram to describe the architecture relative to this test

4. **Simulation** Identify which part in the test need to simulate or mock

5. **Test Steps** Brief the test steps for user review
   Ask user to input "approved" to approve the test

6. **Write Test** Implement the test if user approved the test

7. **Verify Test** ask user to input "execute", and execute the test file to ensure test succeeded.