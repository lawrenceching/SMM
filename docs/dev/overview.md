# Overview

This document describe the overview architecture of SMM.

Key Requirements
* Multi-Frontend - Web UI, Electron, HarmonyOS(ohos), CLI, AI Tool, MCP Tool frontends
* Multi-Distribution - Desktop app, HarmonyOS app, Docker image, CLI
* Layering - The core module abstract the iteraction and state managmenet for SMM business

```mermaid
graph TD
    subgraph L1[Frontend 层]
        A[CLI]
        B[WebUI/MCP/AI]
    end

    subgraph L2[Server 层]
        C[Node.js Server]
        D[Electron]
    end

    subgraph L3[Core 层 — apps/core @smm/core]
        E[业务逻辑抽象接口]
    end

    subgraph L4[Adapter 层]
        F[FsPort]
        G[NetworkPort]
        H[LoggingPort]
        I[NotificationPort]
    end

    %% 自上而下的调用关系
    A -->|直接函数调用| C
    B -->|HTTP API 调用| C
    B -->|HTTP API 调用| D
    
    C -->|函数调用接口| E
    D -->|函数调用接口| E
    
    E -->|适配调用| F
    E -->|适配调用| G
    E -->|适配调用| H
    E -->|适配调用| I
```

```mermaid
flowchart TB
  CLI["CLI"]
  WEB["Web UI"]
  E["Electron App"]
  EM["Electron Main Process"]
  ohos["ohos"]
  AI["AI Tool"]
  MCP["MCP Tool"]
  CORE["apps/core (@smm/core)"]
  N["Node.js Server"]
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

**Core 层** 对应 monorepo 中的 `apps/core`，npm 包名 `@smm/core`。共享类型与纯工具分别位于 `packages/types`（`@smm/types`）与 `packages/utils`（`@smm/utils`）。

## References
[Supported Platform](./supported-platform.md)