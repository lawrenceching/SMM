# Recognize

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

We have two similar recognition functions, don't get confused:

**Recognize Folder** – determines the TV series or movie title for a given media folder. This function is described in [Recognize Folder](./recognize-folder.md)
**Recognize Episodes** – matches local video files to their correct episode numbers within a series. This is what this page describes.

## CLI

```
smm try-to-recognize <folder> --skip
smm apply <planId>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core

  User->>CLI: smm try-to-recognize <folder>
  CLI->>Core: tryToRecognizeEpisodes(folder)
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
  CLI->>Core: tryToRecognizeEpisodes(folder)
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
