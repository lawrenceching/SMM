# Config

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## CLI

```
smm config list
smm config get <key>
smm config set <key> <value>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm config list
  CLI->>Core: getUserConfig()
  Core->>Fs: read smm.json
  Core-->>CLI: UserConfig
  CLI-->>User: JSON stdout
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm config get <key>
  CLI->>Core: getUserConfig()
  Core-->>CLI: UserConfig
  CLI-->>User: JSON value or error
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm config set <key> <value>
  CLI->>CLI: parseConfigValue(value)
  CLI->>Core: setUserConfigKey(key, parsed)
  Core->>Fs: write smm.json
  Core-->>CLI: updated value
  CLI-->>User: JSON stdout
```

```mermaid
flowchart TD
  A[config set value] --> B{valid UserConfig key?}
  B -->|no| C[stderr + exit 1]
  B -->|yes| D{JSON.parse succeeds?}
  D -->|yes| E[store parsed JSON]
  D -->|no| F[store raw string]
  E --> G[write smm.json]
  F --> G
  G --> H[print updated value]
```

## Web UI, Electron and ohos

```mermaid
sequenceDiagram
  participant Browser
  participant CLI
  participant Core
  participant Fs as FsPort

  Browser->>CLI: read/write user config hooks
  CLI->>Core: getUserConfig / setUserConfig
  Core->>Fs: smm.json
  Core-->>CLI: UserConfig
  CLI-->>Browser: { data } / { error }
```

## References

[Supported Platform](./supported-platform.md)
