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
  participant CoreRoutes as core-routes
  participant Fs as smm.json

  Browser->>CLI: POST /api/getUserConfig
  CLI->>CoreRoutes: doGetUserConfig()
  CoreRoutes->>Fs: read
  CoreRoutes-->>Browser: { data: UserConfig }

  Browser->>CLI: POST /api/patchUserConfig
  Note over Browser: JSON Patch ops, field paths only
  CLI->>CoreRoutes: doPatchUserConfig(patch)
  CoreRoutes->>Fs: apply patch, validate, write
  CoreRoutes-->>Browser: { data: UserConfig }
```

`readFile` and `writeFile` reject `smm.json`. User config is only read through `POST /api/getUserConfig` and updated through `POST /api/patchUserConfig` (RFC 6902 `add`, `remove`, `replace` on known fields). HarmonyOS uses the same handlers on the core-routes HTTP server.

## References

[Supported Platform](./supported-platform.md)
