# 启动/退出清理动作抽取到 core-routes

## 背景

SMM 在程序启动和退出时执行清理操作，包括：
- **命令执行日志清理** (`CommandLogCleaner`): 清理 `{logDir}/commands/` 下超过 100 个的最旧日志目录
- **yt-dlp cookies 临时文件清理** (`YtdlpCookiesCleaner`): 清理 `{userDataDir}/temp/` 下的管理 cookie 文件
- **preparing plan 文件清理** (`cleanPreparingPlans`): 清理 `{appDataDir}/plans/` 下 status=`preparing` 的计划文件

当前 `cleanPreparingPlans` 函数在 `packages/core-routes/src/tools/plans.ts` 中，但**调用此清理的动作**直接写在 `apps/cli/index.ts` 中，未在 OHOS 环境执行。

## Goal

将清理动作的编排逻辑抽取到 `packages/core-routes`，使所有运行环境 (CLI、OHOS Electron) 共享统一的清理调用，确保 stale plan 文件在所有平台上都被清理。

## Codebase Analysis

### 架构

```
packages/core-routes/          ← 共享 HTTP 接口 & 业务逻辑
├── src/
│   ├── tools/plans.ts          ← cleanPreparingPlans() 已存在 ✅
│   ├── cleanup.ts              ← 新文件: 清理动作编排 (本次新增)
│   └── index.ts                ← 导出 (本次修改)

apps/cli/                       ← Bun 后端
├── index.ts                    ← 启动/退出入口, 调用各 cleaner (本次修改)
├── src/utils/
│   ├── CommandLogCleaner.ts    ← CLI 特有, 不迁移
│   └── YtdlpCookiesCleaner.ts  ← CLI 特有, 不迁移

apps/ohos/                      ← HarmonyOS Electron
├── src/
│   ├── main.ts                 ← Electron 主进程入口, 无清理 (本次修改)
│   ├── http/server.ts          ← HTTP 服务启动, 无清理 (本次修改)
│   └── core-routes-loader.ts   ← 运行时加载 core-routes.js, 类型定义 (本次修改)
```

### 当前代码流

```
apps/cli/index.ts:
  startup:
    CommandLogCleaner.clean()       ← CLI 特有
    YtdlpCookiesCleaner.cleanAll()  ← CLI 特有
    cleanPreparingPlans()           ← 应提升到 core-routes 编排
  shutdown (beforeStop):
    YtdlpCookiesCleaner.cleanAll()  ← CLI 特有
    cleanPreparingPlans()           ← 应提升到 core-routes 编排

apps/ohos/src/main.ts:
  startup:
    无清理
  shutdown:
    无 before-quit handler → 无清理

apps/ohos/src/http/server.ts:
  startup:
    startMainHttpServer() → 加载 core-routes.js → 启动 HTTP
    无清理
```

### 关键约束

1. `core-routes` 通过 `node:fs/promises` 操作文件系统，运行时无关 (Bun/Node 均可)
2. OHOS 通过 `createRequire` 动态加载 `core-routes.js`，必须在 `CoreRoutesModule` 类型中声明新导出
3. `CommandLogCleaner` 和 `YtdlpCookiesCleaner` 依赖 CLI 特定的 `logDir`/`userDataDir`，保留在 CLI 中，不迁移
4. `cleanPreparingPlans` 需要 `appDataDir` (所有环境都需要) + `ChatFs` (由 `defaultChatFs()` 提供)
5. OHOS 没有 `before-quit` 事件的 registered handler — 需要新增

## References

- [cleanup.md](../cleanup.md) — 命令日志清理设计
- [core-routes-migration.md](../core-routes-migration.md) — core-routes 架构 & OHOS 加载方式
- [harmonyos-integration.md](../harmonyos-integration.md) — OHOS 集成详细设计
