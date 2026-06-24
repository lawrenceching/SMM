---
name: wlap:context
version: "0.0.1"
description: Have thorough understanding of codebase and describe the context like a professional developer
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - AskQuestion
---

# work-like-a-pro context

This tool aims to create a context file to describe the context of a requirement, a change, an issue, etc ect,

The context file is used as a context or background information for subsequence ativities.

**IMPORTANT** You don't need to think how to implement change or root cause of issue. You focus on understanding the change, the codebase and summarize the context.

1. **Understanding** - Have thorough understanding of the system, read `.agents/docs/architecture.md` first. And read docments in `.agents/docs/design/` folder that may relative to this issue.

2. **Ask Questions** - Think about the issues and ask questions to clarify the user story.
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

   **IMPORTANT** You can invoke several rounds of Q&A until you fully clarify the issue.

3. **Create Context File** - Create context file in `.agents/docs/design/[change-name]/context.md` following below template:
   ```markdown
   # [change name]

   [background]

   ## Goal

   [write the change]

   ## Codebase Analysis

   ### Architecture
   [draw a graph to brief the high level architecture]

   ### Code flow

   [draw a graph to brief the code flow]

   ## References
   [list the relative design documents]
   ```

   You SHOULD describe the context like a professional developer, using technical words.