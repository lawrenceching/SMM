# HarmonyOS FAQ

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

设计文档：`.agents/docs/design/open-in-file-manager.md`
