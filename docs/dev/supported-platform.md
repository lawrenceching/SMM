# Supported Platform

**CLI**

User use SMM as command line interface which implemented in apps/cli.

For example
```
smm --help
smm list
smm tmdb search "Batman"
```

NOTE: the binary executable smm works as cli, web server and mcp server depends on the command line arguments.

The term "Server", "HTTP Server", "CLI" both refer to code in apps/cli.

**Web UI**

User operates in web UI which implemented in apps/ui.

The web server is provided in cli as well:
```
# run smm without any arguments
smm
Server is listening at http://localhost:8080
```

**Electron**

Electron desktop app

```
Electron
  |-- Main Process (node.js side)
        |-- core (built from apps/core)
        |-- core-routes (built from packages/core-routes)
  |-- UI (browser side, built from apps/ui)
```


**HarmonyOS/ohos**

User operates in HarmonyOS app, which is a Electron desktop application ported to HarmonyOS.

See https://gitcode.com/openharmony-sig/electron.

```
HarmonyOS App
  |-- Electron
        |-- Main Process (node.js side)
              |-- core (built from apps/core)
              |-- core-routes (built from packages/core-routes)
        |-- UI (browser side, built from apps/ui)
  |-- ArkTS
```

**AI tool**

User operates in built-in AI Agent chat window.
AI Agent call tools to perform SMM functions.

**MCP tool**

User operates in external AI Agent(such as claude code, opencode, Cherry Studio).

External AI Agent talk to SMM via MCP using Streamable HTTP protocol.

User starts MCP server by:

1. Start web server and turn on MCP server using web UI.
2. Start MCP server using CLI