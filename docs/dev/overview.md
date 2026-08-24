# Overview

This document describe the overview architecture of SMM.

Key Requirements
* Multi-Frontend - Web UI, Electron, HarmonyOS(ohos), CLI, AI Tool, MCP Tool frontends
* Multi-Distribution - Desktop app, HarmonyOS app, Docker image, CLI

```mermaid
flowchart TB
  CLI["CLI"]
  WEB["Web UI"]
  E["Electron App"]
  EM["Electron Main Process"]
  ohos["ohos"]
  AI["AI Tool"]
  MCP["MCP Tool"]
  CORE["apps/core"]
  N["apps/cli"]
  NET["NetworkPort"]
  FS["FsPort"]
  LOG["LoggingPort"]
  
  CLI -->N
  WEB --> N
  E --> EM
  ohos --> EM
  AI --> N
  MCP --> N
  N -->CORE
  EM -->CORE
  CORE --> NET
  CORE --> FS
  CORE --> LOG
```

## References
[Supported Platform](./supported-platform.md)