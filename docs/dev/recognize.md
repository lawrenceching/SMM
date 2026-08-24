# Recognize (episode file mapping)

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## CLI

```
smm try-to-recognize <folder>
smm apply <planId>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core

  User->>CLI: smm try-to-recognize <folder>
  CLI->>Core: tryToRecognizeFolder(folder)
  Core-->>CLI: RecognizeMediaFilePlan (pending)
  CLI-->>User: plan id + result
  User->>CLI: smm apply <plan id>
  CLI->>Core: applyPlan(planId)
```

## Web UI, Electron and ohos

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: click recognize button
  Browser->>CLI: POST /api/try-to-recognize-episodes
  CLI->>Core: tryToRecognizeFolder(folder)
  Core->>CLI: RecognizeMediaFilePlan (pending)
  CLI->>Browser: RecognizeMediaFilePlan
  Browser->>User: show RuleBasedRecognizePrompt
  User->>Browser: click confirm button
  Browser->>CLI: POST /api/apply-plan
  CLI->>Core: applyPlan()
  Core->>Core: update MediaMetadata
```

## References

[Import Folder](./import-folder.md)

[Supported Platform](./supported-platform.md)
