# HarmonyOS FAQ

## 如何判断是否 HarmonyOS 环境

鸿蒙版 SMM 仍是 Electron 应用，但运行时与 Windows/macOS/Linux 不同。检测方式取决于代码运行在 **UI 渲染进程** 还是 **Electron 主进程**（含 `apps/ohos/src`、`packages/electron-common`）。

| 运行位置 | 函数 | 文件 | 依据 |
|----------|------|------|------|
| UI 渲染进程 | `isHarmonyOS()` | `apps/ui/src/lib/isHarmonyOS.ts` | `navigator.appVersion` 含 `OHOS` 或 `OpenHarmony` |
| 主进程（ohos） | `isHarmonyOSPlatform()` | `apps/ohos/src/ipc/file-access-permission.ts` | `process.platform === "ohos" \|\| "openharmony"` |
| 主进程（electron-common） | `isHarmonyOSElectron()`（内部） | `packages/electron-common/src/fileAccessPersistIpc.ts`、`openInFileManagerTask.ts` | 同上 |

### UI 渲染进程

```typescript
// apps/ui/src/lib/isHarmonyOS.ts
export function isHarmonyOS(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }
  const appVersion = navigator.appVersion
  return appVersion.includes("OHOS") || appVersion.includes("OpenHarmony")
}
```

在 DevTools 控制台可快速确认：

```javascript
navigator.appVersion
// 鸿蒙 Electron 通常包含 "OHOS" 或 "OpenHarmony"
```

**本应用中的用途示例**：`persistHarmonyOSFileAccess()`（导入目录前 persist 权限）、`Assistant.tsx`（部分 AI 能力在鸿蒙上的展示逻辑）。

### Electron 主进程

```typescript
// apps/ohos/src/ipc/file-access-permission.ts
export function isHarmonyOSPlatform(): boolean {
  const platform = process.platform as string
  return platform === "ohos" || platform === "openharmony"
}
```

主进程日志中可打印 `process.platform` 核对；鸿蒙 Electron 为 `ohos` 或 `openharmony`，桌面为 `win32` / `darwin` / `linux`。

**本应用中的用途示例**：`file-access-permission.ts` 中仅在鸿蒙平台注册 `fileAccess:persist` / `fileAccess:activate` IPC；`electron-common` 中仅在鸿蒙上对 `shell.showItemInFolder` 失败时走 native fallback。

### 设计注意

- 大多数鸿蒙能力（打开文件夹、打开文件、原生对话框）通过 **与桌面相同的 preload / IPC 契约** 实现，UI **不应** 为鸿蒙单独分支；见 [harmonyos-integration.md](./design/harmonyos-integration.md)。
- 仅在确有平台差异时使用 `isHarmonyOS()` / `isHarmonyOSPlatform()`（例如 persist 权限、可选功能开关），不要用它替代 `isElectron()` 或 `window.api.executeChannel` 是否存在来判断 Electron 能力是否可用。

## `WebAssembly is not defined`

### 表现

鸿蒙 **主进程**（`core-routes`、`apps/ohos/src`）里调用全局 `fetch()` 失败：

```
ReferenceError: WebAssembly is not defined
```

例如 reverse proxy、 `POST /api/downloadImage`、 `GET /api/image` 等出站 HTTP。

UI 渲染进程里的 `window.fetch` 不受影响。

### 原因

鸿蒙化的 Electron (openharmony-sig/electron) 用 musl + aarch64 重新编译的 Node.js 运行时, 并没有打开 WebAssembly, 导致 globalThis.WebAssembly 不可访问, 进而影响基于 undici 实现的 fetch.

该问题只影响 Electron 主进程 JavaScript 代码.

### 解决方案

**思路**：不用 Node 内置 `fetch`（undici），改用 Node 原生 `node:http` / `node:https` 发 HTTP 请求。这两者是纯 JavaScript + Node 内置模块，不依赖 WebAssembly。

**`createNodeHttpFetch()` 做了什么**（`packages/core-routes/src/nodeHttpFetch.ts`）：

- 返回一个与 `fetch` 签名兼容的函数 `(url, init) => Promise<Response>`
- 内部用 `http.request` / `https.request` 建立 TCP 连接、发送请求、读取响应 body
- 若响应带 `Content-Encoding`（gzip / deflate / br），用 `node:zlib` 解压后再返回
- 调用方仍按 `fetch` 用法写（`await fetchImpl(url, { method, headers })`），无需改业务逻辑

**在本应用中怎么用**：

1. 出站 HTTP 的 core 函数接受 `fetchImpl?: typeof fetch`，默认 `fetch`，鸿蒙注入 `createNodeHttpFetch()`
2. `apps/ohos/src/http/server.ts` 创建一次 `nodeHttpFetch`，传给 reverse proxy 和 core-routes：

```typescript
const nodeHttpFetch = createNodeHttpFetch()
// reverseProxyConfig.fetchImpl = nodeHttpFetch
// coreRoutesHandler config: fetchImpl: nodeHttpFetch
```

CLI / 桌面端继续用默认全局 `fetch`，无需改动。

### 本应用已有例子

| 功能 | 位置 |
|------|------|
| Reverse proxy | `reverseProxy.ts` → `ReverseProxyConfig.fetchImpl` |
| 下载图片到文件 | `downloadImageAsFile.ts` → `CoreRoutesConfig.fetchImpl` |
| 远程图片预览 | `downloadImage.ts` → 同上 |
| ohos 注入 | `apps/ohos/src/http/server.ts` |

修改 `core-routes` 或 `apps/ohos/src` 后需重新构建鸿蒙资源（`core-routes.js`、`main.js`），见 `apps/ohos/README.md`。

## 「在资源管理器中打开」失败

### 表现

Sidebar 右键媒体目录，或菜单打开应用数据/日志目录时，操作无反应或 toast 报错。

### 原因

1. **路径无访问权限** — 鸿蒙只能打开应用沙箱路径，或用户通过 DocumentViewPicker 授权并 persist 过的目录 URI（`file://docs/storage/...`）。
2. **`shell.showItemInFolder` 未映射** — 主进程会 fallback 到 `EtsBridge.OpenItemInFolder` → `FileManagerAdapter.OpenItemInFolder`（`filemanager://openDirectory`）。
3. **preload / main 未更新** — 需 `pnpm run build:ohos` 重新生成 `main.js` 与 `preload.js`。

### 排查

- 确认 `window.api.executeChannel` 在 DevTools 中可用。
- 查看主进程日志前缀 `[OpenInFileManager]`，区分 shell 失败与 native fallback。
- 媒体目录路径应与 `smm.json` `folders[]` 中存储的 URI 一致。

设计文档：`.agents/docs/design/harmonyos-integration.md`

## 「打开」文件失败

### 表现

TvShowPanel fanart、MusicPanel 音轨等右键或双击「打开」无反应，或控制台报错。

### 原因

1. **路径无访问权限** — 与「在资源管理器中打开」相同，文件须位于 persist 过的媒体目录 URI 下（`file://docs/storage/...`）或应用沙箱内。
2. **`shell.openPath` 失败** — 主进程日志前缀 `[OpenFile]` 会输出 `shell.openPath` 返回的错误字符串。
3. **preload / main 未更新** — 需 `pnpm run build:ohos` 重新生成 `main.js`（含 `open-file` executeChannel 路由）。

### 排查

- 确认 `window.api.executeChannel` 在 DevTools 中可用。
- 打开文件时不应请求 `POST /api/openFile`（Electron 走 IPC）；若出现该请求且返回 404，说明 preload 未注入或版本过旧。
- 查看主进程日志前缀 `[OpenFile]`。

设计文档：`.agents/docs/design/open-file.md`
