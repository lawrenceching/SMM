# Ohos E2E Test Infrastructure — `setup` 适配分析

> 本文记录将 `apps/e2e/test/lib/testbed.ts` 的 `setup` / `cleanup` 适配到鸿蒙（ohos）环境时的发现与改造清单。
>
> 相关文档：[wdio-in-harmonyos.md](./wdio-in-harmonyos.md)

## 约束

ohos 通过 **浏览器协议（Chromedriver attach）** 连接远端已运行应用：

- WDIO 只能操作渲染进程（DOM、`browser.execute`）
- **没有**本机 `fs`、也没有从开发机直连设备沙箱文件的通道
- 设备侧 HTTP API 在应用内（如 `http://127.0.0.1:18081`），开发机上的 `fetch('http://localhost:30000/...')` **不可用**（除非另做端口转发，且仍碰不到沙箱路径上的 Node `fs`）

**不引入** `window.smm`（或类似页面注入桥）。测试侧用 WDIO 在页面上下文中直接执行 JavaScript，对同源端口做 `fetch`：

```ts
// 示意：在渲染进程内 fetch 应用本地 API
await browser.execute(async (dirPath) => {
  const res = await fetch('/api/deleteFolder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath }),
  })
  return await res.json()
}, metadataDir)
```

相对路径 `/api/...` 会打到页面当前 origin（ohos 上为 `http://127.0.0.1:18081`），由主进程/内嵌 HTTP 处理，再落到设备沙箱上的文件系统操作。

---

## 新增 API：`POST /api/deleteFolder`

与现有 `POST /api/deleteFile` 对称：删**目录**（递归），而非单文件。

### 契约（草案）

| 项 | 说明 |
|----|------|
| 路径 | `POST /api/deleteFolder`（与项目 RPC 风格一致，对齐 `/api/deleteFile`） |
| Body | `{ path: string }`（平台路径或 POSIX，服务端 normalize） |
| 成功 | `{ data: { path }, error?: undefined }` |
| 失败 | `{ data?: …, error: "…" }`（白名单拒绝、非目录、权限等） |
| 实现落点 | `packages/core-routes` 增加 `doDeleteFolder` + route；`apps/cli` / `apps/ohos` 复用同一 handler（与 `deleteFile` 相同接入方式） |
| 文件系统 | `fs.rm(path, { recursive: true, force: true })`（或等价）；ENOENT 可作幂等成功（对齐 `deleteFile`） |

### 白名单校验（必须复用现有实现）

**不要**为 `deleteFolder` 另写一套路径规则。现有文件类 API 已统一：

| 层 | 文件 | 职责 |
|----|------|------|
| 校验 | `packages/core-routes/src/allowlist.ts` → `validatePathIsInAllowlist(path, allowlist)` | `path.startsWith(allowlistItem)` |
| 组装（CLI） | `apps/cli/src/utils/buildAllowlist.ts` → `buildAllowlist()` | 生成 allowlist 数组 |
| 消费示例 | `doDeleteFile` / `doWriteFile` / `doReadFile` / `doReadImage` / … | `config.allowlist` + 上述 validate |

`buildAllowlist()` 当前包含（POSIX）：

1. `userDataDir` — 含 `smm.json` 等
2. `appDataDir` — **覆盖**其下 `metadata/`、`plans/` 等子目录
3. `tmpDir` — 临时目录（测试媒体若落在 tmp 下也覆盖）
4. `userConfig.folders[]` — 用户已导入的 **media folder** 路径

因此 e2e 关心的目标路径均可落在白名单内，**无需**单独枚举 `metadata` / `plans`：

| 删除目标 | 典型路径 | 为何被允许 |
|----------|----------|------------|
| metadata 目录 | `{appDataDir}/metadata` | 前缀匹配 `appDataDir` |
| plans 目录 | `{appDataDir}/plans` | 前缀匹配 `appDataDir` |
| media folder | `userConfig.folders` 中的某一项 | 显式列入 allowlist |
| 测试媒体 tmp | `{tmpDir}/…`（若 fixture 建在此） | 前缀匹配 `tmpDir` |

实现时与 `doDeleteFile` 相同模式：

```ts
const posixPath = Path.posix(path.resolve(filePath))
if (!validatePathIsInAllowlist(posixPath, allowlist)) {
  return { error: `Path "${filePath}" is not in the allowlist` }
}
// 再确认是目录并 rm recursive
```

CLI 侧注入：`processDeleteFolder` 内 `const allowlist = await buildAllowlist()`，再调 `doDeleteFolder(body, { allowlist, logger })`（同 `DeleteFile.ts`）。

### ohos 注意

`apps/ohos/src/http/server.ts` 的 `buildCoreRoutesAllowlist()` 与 CLI 的 `buildAllowlist()` **不完全相同**（含 `userData` / `temp` / `homedir` / app root，且未必同步 `userConfig.folders`）。落地 `deleteFolder` 时需确认 ohos 侧 allowlist 仍能覆盖：

- `appDataDir/metadata`、`appDataDir/plans`
- 测试用 media folder 路径

必要时让 ohos 侧对齐 CLI 的 `folders` 条目，避免「删媒体目录」被白名单拒绝。

### 与 Sidebar 右键删除的关系

Sidebar 删除走的是 `POST /api/deleteFile`（删**单个** metadata JSON）+ 更新 `userConfig.folders`，且 **不删磁盘上的 media folder**（文案：`will NOT delete from disk`）。

`deleteFolder` 是更底层的目录删除，供 e2e / 运维类场景使用；**不是** Sidebar 产品语义的替代品。`removeDirInSidebar` 仍可继续用 DOM 操作。

---

## `setup` 调用链

```ts
export async function setup(options: {
    removeMetadataDir: boolean,
    removePlansDir: boolean,
    removeMediaFolders: boolean,
    removeDirInSidebar: boolean,
    resetUserConfig: ResetUserConfigOption,
    openBrowserPage: boolean,
    clearLocalStorage?: boolean,
})
```

实际顺序：

1. `cleanup(...)` — 清环境（删目录 / 清 sidebar / 可选写配置 / 可选清 localStorage）
2. `applyResetUserConfig(...)` — **再次**写配置（与 cleanup 内逻辑重复）
3. 若 `openBrowserPage`：`Page.open()` → 等 StatusBar
4. 若在开页路径且 `clearLocalStorage`：再清一次 localStorage

实现入口：

| 符号 | 文件 |
|------|------|
| `setup` / `cleanup` | `apps/e2e/test/lib/testbed.ts` |
| `removeMetadataDir` / `removePlansDir` / `resetUserConfig` / `removeTestMediaTmpDir` / `hello` | `packages/test/src/index.ts` |
| `Page.open` | `apps/e2e/test/pageobjects/page.ts` |
| `removeDirInSidebar` | `Sidebar.deleteAllFolders()`（WebDriver DOM） |

---

## 选项对照表

| option | 实际调用 | 当前通道 | ohos 适配 |
|--------|----------|----------|-----------|
| `removeMetadataDir` | `hello()` 拿路径 + `fs.rmSync(appDataDir/metadata)` | 本机 Node fs | **要改** → `fetch('/api/deleteFolder')` |
| `removePlansDir` | `hello()` + `fs.rmSync(appDataDir/plans)` | 本机 Node fs | **要改** → `fetch('/api/deleteFolder')` |
| `removeMediaFolders` | `removeTestMediaTmpDir` → 删 `os.tmpdir()/smm-test-media` | 本机 Node fs（不依赖 app） | **要改** → `deleteFolder` + 设备侧 fixture 策略 |
| `resetUserConfig` | `getUserConfigPath()` + `fs.writeFileSync(smm.json)` | 本机 Node fs + host `fetch localhost:30000` | **要改** → `writeFile` / `readFile` |
| `removeDirInSidebar` | `Sidebar.deleteAllFolders()` | WebDriver DOM | **可复用**（需会话已附着） |
| `clearLocalStorage` | `browser.execute(localStorage.clear)` | WebDriver | **可复用** |
| `openBrowserPage` | `Page.open()` → `browser.url(5173)` + `_smm_status` | 本机 Vite URL | **要改** |

---

## 必须改造

### 1. `removeMetadataDir`

- **现状**：`hello()` → `getMetadataDir()` → `fs.rmSync`
- **目标**：`browser.execute` 内 `fetch('/api/hello')` 解析 `appDataDir/metadata`，再 `fetch('/api/deleteFolder', { path })`
- **缺口**：需新增 `POST /api/deleteFolder`（白名单复用上文）；现有 `deleteFile` 不能删目录

### 2. `removePlansDir`

- 与上相同，目标路径为 `appDataDir/plans`
- 共用 `deleteFolder`

### 3. `resetUserConfig` / `applyResetUserConfig`

- **现状**：host 侧 `hello()`（写死 `http://localhost:30000/api/hello`）拿 `userDataDir`，再 `fs.writeFileSync`
- **问题**：ohos 上 API 在设备本地；host 的 `fetch` / `fs` 都碰不到沙箱文件
- **目标**：`browser.execute` 内串联已有 HTTP API，例如：
  - `fetch('/api/hello')` 拿 `userDataDir`
  - `fetch('/api/writeFile', { path: userDataDir/smm.json, content: … })`
- `resetUserConfig: (config) => ...` 自定义 updater 也要改成「读 → 改 → 写」全在 `browser.execute` + `fetch` 侧完成（读可用 `/api/readFile`）

### 4. `removeMediaFolders`

- **现状**：删开发机临时目录 `os.tmpdir()/smm-test-media`，且不依赖 app
- **ohos**：测试媒体必须在设备侧；不能沿用 host tmp
- **改造不止删目录**：还涉及 fixture 准备（设备路径、`fileAccess:persist` 等，见 [wdio-in-harmonyos.md](./wdio-in-harmonyos.md) §7.2）
- 删除本身走 `fetch('/api/deleteFolder')`（路径须在 allowlist：`tmpDir` 或 `userConfig.folders`）

### 5. `openBrowserPage` → `Page.open()`

- **现状**：`browser.url(resolveUiPageUrl())` 指向 Vite `localhost:5173`
- **ohos attach**：应用已加载 `http://127.0.0.1:18081/`，不应再 `url(5173)`
- **目标**：跳过导航，只等 `window._smm_status === 'ready'`（或 StatusBar），与 `ohos/hello.attach.e2e.ts` 一致

### 6. 隐藏依赖：`hello()`（`@smm/test`）

- 被 `getMetadataDir` / `getPlanDir` / `getUserConfigPath` 间接使用
- host 侧写死 `localhost:30000`，在 ohos 上不可用
- 路径发现应改为 `browser.execute` 内 `fetch('/api/hello')`，而不是 WDIO 进程直连

---

## 可复用（已是浏览器协议）

| 操作 | 说明 |
|------|------|
| `removeDirInSidebar` | DOM 操作，attach 后即可用 |
| `clearLocalStorage` | 已是 `browser.execute` |

### 顺序问题

当前 `cleanup`（含 sidebar 清理）在 `openBrowserPage` **之前**执行。

- 桌面：若上一轮留下页面，可能碰巧可用
- ohos attach：会话已在，但页面未 ready 时 sidebar 清理会失败

改造后建议顺序：

```text
确保页面 ready
  → 清目录 / 写配置（browser.execute + fetch /api/...）
  → （可选）清 sidebar / localStorage
```

---

## 按改造模式分组

### A. 删目录（新增 `POST /api/deleteFolder` + `browser.execute` + `fetch`）

- `removeMetadataDir`
- `removePlansDir`
- （可选）`removeMediaFolders` 的删除部分

模式：

```text
browser.execute
  → fetch('/api/hello')           // 解析 appDataDir / 相关根路径
  → fetch('/api/deleteFolder')    // 白名单校验 + 主进程 fs.rm recursive
```

白名单：`validatePathIsInAllowlist` + `buildAllowlist()`（见上文）。

### B. 写配置（可复用现有 `writeFile` / `readFile`）

- `resetUserConfig` / `applyResetUserConfig` / `updateUserConfig`

模式：

```text
browser.execute
  → fetch('/api/hello')
  → fetch('/api/readFile') / fetch('/api/writeFile')  // smm.json
```

### C. 开页语义

- `openBrowserPage` / `Page.open`

模式：attach 下 skip `browser.url`，只 wait ready。

### D. 已是 WebDriver

- `removeDirInSidebar` / `clearLocalStorage`

模式：保持；调整执行顺序到 ready 之后。

### E. 媒体 fixture（超出 `setup` 单点，但被 `removeMediaFolders` 牵连）

- `setupTestMediaFolders` / 导入步骤里的本机路径

模式：设备侧目录 + 权限；删除用 `deleteFolder`，前提是路径在 allowlist 内。

---

## 建议落地优先级（仅 `setup` 范围）

1. **新增 `POST /api/deleteFolder`（复用 allowlist）+ e2e 侧 `browser.execute`/`fetch` 封装**：支撑 metadata / plans 清理 — **已完成**
2. **配置读写走页面内 `fetch`**：`resetUserConfig` / `updateUserConfig` — **已完成**（`TESTBED_V2` + `browser-fs.ts`）
3. **`Page.open` ohos 分支**：attach 不导航 — **未做**（桌面 e2e 仍用 `resolveUiPageUrl()`）
4. **调整顺序**：ready → 清目录/写配置 →（可选）清 sidebar / localStorage — **已完成**（`ensureBrowserOnUiPage` + 保留二次 `Page.open` 刷新）
5. **`removeMediaFolders`**：等设备侧媒体策略定了再接 — **暂留 host fs**（`os.tmpdir()/smm-test-media` 常不在 CLI allowlist 的 `getTmpDir()`=`.../Temp/smm` 下）

### 当前实现入口

| 符号 | v2 通道 |
|------|---------|
| `TESTBED_V2` | `apps/e2e/test/lib/testbed.ts` 总开关（`false` 回滚全部） |
| helpers | `apps/e2e/test/lib/browser-fs.ts` |
| `removeMetadataDir` / `removePlansDir` | `deleteAppDataSubdirViaBrowser` → `/api/deleteFolder` |
| `resetUserConfig` / `updateUserConfig` | `/api/hello` + `/api/readFile` / `/api/writeFile` |
| `removeTestMediaTmpDir` | 仍为 `@smm/test` host fs |

桌面回归：`pnpm e2e:tv`（2026-07-18）**11/11 passed** under `TESTBED_V2=true`.

---

## 已有相近能力

| 能力 | 位置 | 与 `deleteFolder` 的关系 |
|------|------|--------------------------|
| `validatePathIsInAllowlist` | `packages/core-routes/src/allowlist.ts` | **直接复用** |
| `buildAllowlist()` | `apps/cli/src/utils/buildAllowlist.ts` | **直接复用**（组装 allowlist） |
| `POST /api/deleteFile` | `packages/core-routes` `doDeleteFile` | 模式模板（校验 + 删）；只能删文件，不能删目录 |
| Debug `cleanUp` | `apps/cli/src/route/Debug.ts` | 可删 metadata 目录，但是 host→CLI / debug 通道，不宜作 ohos e2e 主路径 |
| UI `writeFile` / `readFile` / `hello` | `apps/ui/src/api/*` | 配置读写与路径发现可复用 HTTP 契约 |

---

## 建议代码结构（来自 wdio-in-harmonyos §7.2）

```text
apps/e2e/
  test/lib/testbed/
    index.ts               # 对外 API
    desktop.ts             # 现有逻辑
    ohos.ts                # 鸿蒙 setup/cleanup（browser.execute + fetch）
  ohos/wdio.conf.ts        # 鸿蒙 attach
```

在 `ohos/wdio.conf.ts` 的 `before`/`after` 中走 `testbed/ohos.ts`，尽量让 `test/specs/**` 保持不变。

---

## 消费方示例

`apps/e2e/ohos/tv/TVShow-Import.e2e.ts` 已在 `beforeEach` / `afterEach` 调用完整 `setup` / `cleanup` 选项集，是 ohos 适配的首要验证点。

---

## 日志

目标：把鸿蒙设备上的应用日志传回开发机，写入本地 artifacts，提高 ohos e2e 失败时可观察性。

### 现状

| 日志来源 | 现状 |
|----------|------|
| 主进程 / core-routes | `console.*` → HiLog；tag=`Electron`，bundle=`com.huawei.ohos_electron` |
| UI / renderer | 桌面有 `POST /api/log` → `browser.log`；ohos 侧多为 console，未见完整 pino 文件落盘 |
| hello 声明的 `logDir` | `{userDataDir}/logs`（设备沙箱）；host 侧 Node `fs` **碰不到** |
| ohos e2e | `ohos/wdio.conf.ts`：`hdc fport` attach + **A HiLog** + **D1 CDP 前端 console**（见下） |

设备上已能滤出应用日志：

```bash
hdc shell "hilog -x -e Electron"
# → A00001/com.huawei.ohos_electron/Electron: [core-routes] ...
```

### 可用通道（hdc 原生）

| 通道 | 能力 |
|------|------|
| `hdc hilog` / `hdc shell hilog` | 实时或 `-x` 读 buffer；可按 `-T` / `-P` / `-e` 过滤 |
| `hdc file recv`（含 `-b` debug 应用目录） | 从设备拉文件 |
| `hdc bugreport` | 整包诊断，体积大 |
| `hdc fport` | 已用于 CDP；也可转发应用 HTTP，再经 `/api/readFile` 读 `logDir` |
| CDP / WDIO | 可抓 console、网络；**不含**主进程 Node 日志 |

### 方案

状态标记约定：

- `pending-for-verification` = 已调研、尚未在 e2e 流水线中落地验证
- `verified` = 已用指定命令跑通并确认本地落盘内容可用

#### A. HiLog 旁路采集 — `verified`（2026-07-19）

**实现**：`apps/e2e/ohos/lib/hilog-capture.ts`，由 `ohos/wdio.conf.ts` 的 `onPrepare` / `onComplete` 调用。

```bash
hdc shell hilog -r                         # 清 buffer
hdc shell hilog -T Electron                # 流式写入 reports/ohos-hilog/device-hilog.log
# 落盘时对 apiKey / sk-* 做简单脱敏
```

开关：`OHOS_HILOG_CAPTURE=false` 可关闭；`OHOS_HILOG_TAG` 可改 tag（默认 `Electron`）。

| 优点 | 缺点 |
|------|------|
| 零改应用；已有日志直接可用 | 噪声依赖 tag 过滤；buffer 有上限，长测可能丢早期行 |
| 与现有 hdc 生命周期对齐 | 主进程多行 object 日志会被拆行 |
| 失败时立刻有本地文件 | 不含沙箱内专属文件日志（若以后有） |

**验证**（故意失败的 smoke，用于确认关键日志可捕捉）：

```bash
pnpm wdio:ohos --spec ./ohos/tv/TVShow-Import.e2e.ts
```

结果（2026-07-19）：

- 用例失败：`Timeout`（设计预期；含 5min pause / mocha timeout）
- 本地文件：`apps/e2e/reports/ohos-hilog/device-hilog.log`（约 68KB）
- 已捕捉关键主进程行：`[core-routes] [DeleteFolder]` / `doWriteFile` / `doIsFolderAvailable` / `[ListFiles]` / `traceId: 'e2eTest:ImportFolderInHarmonyOS'` / 路径 `/storage/Users/currentUser/Download/Music`

#### B. 设备文件日志 + `hdc file recv` — `pending-for-verification`

给 ohos 主进程补文件 logger（对齐 CLI 的 `smm.log`），测后：

```bash
hdc file recv -b <remote-log> ./artifacts/.../smm.log
```

或经 `browser.execute` + `/api/readFile` 读出再写本地。

| 优点 | 缺点 |
|------|------|
| 结构化、可轮转、对齐桌面 | 要改应用；recv 路径/权限需摸清 |
| 不受 HiLog buffer 限制 | 实时性差（适合 afterEach / onFailure） |

#### C. HTTP / fport 拉日志 API — `pending-for-verification`

新增或复用读日志接口，WDIO 经页面 `fetch` 或 host→`fport 18081` 拉取。

| 优点 | 缺点 |
|------|------|
| 与 testbed v2（browser-fs）一致 | 依赖应用已 ready；启动失败时可能拉不到 |
| 可只拉最近 N 行 | 需鉴权/白名单设计 |

#### D1. CDP / Classic WebDriver 订阅 console — `verified`（2026-07-19）

**实现**：`apps/e2e/ohos/lib/frontend-console-capture.ts`，由 `ohos/wdio.conf.ts` 的 `before` / `after` 调用。

在 Chromedriver 已 attach 到 `debuggerAddress` 后，再连同一调试口的 **page** target WebSocket，启用：

- `Runtime.enable` → `Runtime.consoleAPICalled`（含启用时的历史 console buffer）
- `Runtime.exceptionThrown`
- 可选 `Log.enable`

落盘：`reports/ohos-hilog/frontend-console.log`（对 `apiKey` / `sk-*` 简单脱敏）。

开关：`OHOS_FRONTEND_CONSOLE_CAPTURE=false` 可关闭。

| 优点 | 缺点 |
|------|------|
| 零改应用；与 Classic attach 契合；可与 Chromedriver 并存 | 对象参数常显示为 `Object`（需 `Runtime.getProperties` 才能展开） |
| 能抓前端 DIAG / 业务错误 | 页面导航后需确认仍挂在同一 target（当前单页 attach 足够） |
| `Runtime.enable` 会回放部分历史 console | 不含主进程日志（仍靠方案 A） |

**验证**：

```bash
pnpm wdio:ohos --spec ./ohos/tv/TVShow-Import.e2e.ts
```

结果（2026-07-19）：

- 本地文件：`apps/e2e/reports/ohos-hilog/frontend-console.log`（约 20KB）
- 已捕捉：`[e2e-cdp-capture] attached`、`[DIAG] main.tsx bootstrap`、`e2eTest:ImportFolderInHarmonyOS`、`Discover request failed: 404 Not Found`、Socket.IO / Sidebar DIAG 等

#### D2. CDP 网络日志 — `pending-for-verification`

扩展桌面 `network-log` 到 ohos attach（CDP `Network.*`），与 D1 并列，不替代 console。

#### D3. 桌面 BiDi `log.entryAdded` — `pending-for-verification`（探针倾向不可用）

ohos 强制 Classic + `debuggerAddress`，桌面 `BROWSER_LOG_ENABLED` 的 BiDi 路径大概率不可用；已由 D1 替代。

### 建议优先级

1. **A** — **已验证**，主进程默认采集  
2. **D1** — **已验证**，前端 console 默认采集  
3. **B** — 长期对齐桌面文件日志（`pending-for-verification`）  
4. **D2 / C** — 按需（`pending-for-verification`）
