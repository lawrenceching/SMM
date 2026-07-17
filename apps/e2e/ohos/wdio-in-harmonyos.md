# 在鸿蒙 Electron 环境运行 WebdriverIO 测试

本文说明如何在 HarmonyOS 设备/模拟器上，对已安装的 SMM 鸿蒙 Electron 应用执行 WDIO 自动化测试。

目标：

- **复用** `apps/e2e/test/specs/` 下的测试逻辑（spec、Component Object、步骤）
- **不复用** 连接层：鸿蒙侧用 **Chromedriver attach**（`debuggerAddress`），而不是 Windows 上的 `wdio-electron-service` 启动 `.exe`

参考：

- [openharmony-sig/electron](https://gitcode.com/openharmony-sig/electron) — 鸿蒙 Electron 编译与 HAP 构建
- [apps/e2e/electron/README.md](../electron/README.md) — 桌面 Windows Electron smoke 测试（对比用）
- [docs/superpowers/reference/faq-harmonyos.md](../../docs/superpowers/reference/faq-harmonyos.md) — 鸿蒙运行时差异

---

## 1. 架构概览

```text
┌─────────────────────┐         hdc fport          ┌──────────────────────────┐
│  开发机 (WDIO)       │  tcp:9222 ──────────────► │  鸿蒙设备 / 模拟器        │
│                     │                           │                          │
│  Chromedriver       │  debuggerAddress attach   │  SMM HAP (Electron)      │
│  + Mocha specs      │ ◄─────────────────────── │  Chromium 渲染进程        │
└─────────────────────┘                           │  --remote-debugging-port │
                                                  └──────────────────────────┘
```

与现有三套 e2e 的关系：

| 套件 | 连接方式 | 被测 UI 来源 |
|------|----------|--------------|
| `apps/e2e/wdio.conf.ts` | 本机 Chrome 启动 | `http://localhost:5173`（Vite dev server） |
| `apps/e2e/electron/wdio.conf.ts` | `wdio-electron-service` 启动 `SMM.exe` | 安装包内嵌 UI |
| **鸿蒙（本文）** | Chromedriver **附着**已运行应用 | `http://127.0.0.1:18081/`（应用内主进程 HTTP） |

鸿蒙版 SMM 主进程在设备本地监听 `MAIN_HTTP_ORIGIN`（见 `apps/ohos/src/paths.ts`：`http://127.0.0.1:18081`），窗口加载该地址，**不需要**在 WDIO 里 `browser.url('http://localhost:5173')`。

---

## 2. 前提条件

### 开发机

- Node.js + pnpm（与 monorepo 一致）
- 已在仓库根目录执行 `pnpm install`
- `apps/e2e` 依赖已就绪（WebdriverIO 9）
- **Chromedriver**：版本需与鸿蒙 Electron 内置 **Chromium 132** 对齐（见 §5），**不要**复用桌面 Chrome 146 的驱动

### 鸿蒙侧

- DevEco Studio 4.0+，HarmonyOS SDK（API 10+）
- 已用 `apps/ohos` 构建并**签名** HAP，且设备可安装运行
- [Command Line Tools](https://developer.huawei.com/consumer/cn/download/) 中的 **`hdc`** 在 PATH 中
- 设备通过 USB 或网络可被 `hdc list targets` 识别

### 测试专用 HAP

`--remote-debugging-port` 会暴露渲染进程调试接口，**仅用于调试/自动化构建**，不要用于正式发布包。见 [openharmony-sig/electron 调试说明](https://gitcode.com/openharmony-sig/electron) 中对 `--remote-debugging-port` 的安全提示。

---

## 3. 在鸿蒙 Electron 上开启渲染进程 Remote Debugging

WDIO 的 `browser.$()` / `browser.click()` 等需要 **Chromium 渲染进程** 的 CDP，不是主进程 Node 的 `--inspect`。

| 开关 | 用途 | WDIO UI 自动化 |
|------|------|----------------|
| `--inspect=9229` | 主进程 Node/V8 调试 | ❌ 仅 `chrome://inspect` 调试主进程 |
| `--remote-debugging-port=9222` | 渲染进程 Chromium CDP | ✅ Chromedriver `debuggerAddress` 所需 |

### 3.1 修改启动参数（推荐入口）

SMM 鸿蒙工程通过 `CommandLineAdapter` 组装 Electron 命令行，默认参数在：

`apps/ohos/web_engine/src/main/ets/common/CommandLineAdapter.ets` → `buildDefaultArgs()`

**验证阶段**可临时在默认参数列表中加入（测试包专用）：

```typescript
// CommandLineAdapter.ets — buildDefaultArgs() 内，仅 debug/自动化 HAP
"--remote-debugging-port=9222",
```

或通过 `appendSwitch` 在窗口创建前注入（若你更希望用编译开关控制）：

```typescript
CommandLineAdapter.getInstance().appendSwitch("remote-debugging-port", "9222");
```

> 官方示例在 `WebWindow.ets` 的 `vec_args` 里追加；本仓库实际走 `CommandLineAdapter.getInstance().getArgs()`，改 `CommandLineAdapter` 或在其被读取前的初始化逻辑即可。

修改后需 **重新编译并安装 HAP**。

### 3.2（可选）主进程调试

若需同时调试主进程，可另加 `--inspect=9229`，并用 `hdc fport tcp:9229 tcp:9229`。这与 WDIO UI 自动化无关，可单独使用。

---

## 4. 安装应用并配置端口转发

### 4.1 确认设备连接

```bash
hdc list targets
```

多设备时后续命令加 `-t <deviceId>`。

### 4.2 安装已签名 HAP

```bash
hdc app install path/to/your-signed.hap
```

或在 DevEco Studio 中点击 Run 安装到设备。

当前模板 `bundleName` 为 `com.huawei.ohos_electron`（`apps/ohos/AppScope/app.json5`）。若你已改为 SMM 专用包名，下文命令中的 bundle 名需一并替换。

### 4.3 端口转发

在**开发机**执行（保持该终端会话，或写入测试 `before` hook）：

```bash
# 渲染进程 WDIO 附着（必须）
hdc fport tcp:9222 tcp:9222

# 可选：主进程 inspect
hdc fport tcp:9229 tcp:9229
```

查看当前转发：

```bash
hdc fport ls
```

取消转发：

```bash
hdc fport rm tcp:9222 tcp:9222
```

### 4.4 启动应用

手动在设备上打开 SMM，或使用：

```bash
hdc shell aa start -a EntryAbility -b com.huawei.ohos_electron
```

等待主窗口出现且 UI 加载完成（状态栏等可见）。

### 4.5 验证 Remote Debugging 已就绪

在开发机执行：

```bash
curl -s http://127.0.0.1:9222/json/version
```

若返回含 `Browser` / `webSocketDebuggerUrl` 的 JSON，说明 attach 链路已通。

也可在 Chrome 打开 `chrome://inspect`，在 Configure 中加入 `localhost:9222`，确认能看到目标页面。

---

## 5. Chromedriver 版本

鸿蒙 Electron 基于 **Chromium 132**（见 [openharmony-sig/electron](https://gitcode.com/openharmony-sig/electron) 与 `pc_chromium_132` 分支）。

Chromedriver 主版本须与 Chromium 一致。OHOS 配置通过 `browserVersion: '132'` 交给 **WDIO 内置下载**，产物落在与浏览器 / 桌面 Electron e2e **相同的** `~/wdio-cache`（由 `apps/e2e/lib/wdioCacheDir.ts` 的 `WDIO_CACHE_DIR` 统一导出）。

各场景 **各自 pin 版本**，互不覆盖：

| 场景 | 配置 | 版本 |
|------|------|------|
| 浏览器 e2e | `wdio.conf.ts` | Chrome 146.x |
| 桌面 Electron | `electron/wdio.conf.ts` | Electron 39.2.6 |
| 鸿蒙 attach | `ohos/wdio.conf.ts` | Chromium **132** |

WDIO 在 `cacheDir` 下按版本分子目录存放（如 `chromedriver/win64-132...`），同根目录多版本可并存。

---

## 6. WDIO 配置（Attach 模式）

`apps/e2e/ohos/wdio.conf.ts` 与 `electron/wdio.conf.ts` 并列，**不要**使用 `wdio-electron-service` 启动应用。要点：

- `cacheDir: WDIO_CACHE_DIR`（共用缓存根路径）
- `browserVersion: '132'`（本场景独立 pin；WDIO 据此下载 **Chromedriver**）
- `goog:chromeOptions.binary: ''`（跳过下载本机 Chrome；浏览器在设备上）
- `goog:chromeOptions.debuggerAddress` attach 到设备 CDP

完整实现见仓库内文件；smoke 用例为 `ohos/hello.attach.e2e.ts`。

### 6.1 运行命令

```bash
cd apps/e2e
pnpm wdio:ohos:hello
```

环境变量：

| 变量 | 含义 | 默认 |
|------|------|------|
| `OHOS_REMOTE_DEBUG_PORT` | 设备与主机一致的调试端口 | `9222` |
| `HDC_PORT_FORWARD_ENABLED` | 默认自动 `hdc fport` / `fport rm`；若端口已转发则报错退出。设为 `false` 可关闭 | `true` |
| `OHOS_BUNDLE_NAME` | HAP bundle 名 | `com.huawei.ohos_electron` |
| `OHOS_ABILITY_NAME` | 入口 Ability | `EntryAbility` |

---

## 7. 复用现有测试文件

### 7.1 适合直接复用

- `apps/e2e/test/specs/**/*.e2e.ts` 中的 **DOM 交互与断言**
- `apps/e2e/test/componentobjects/**`
- `apps/e2e/test/steps/**`（不依赖本机文件路径的步骤）

只要 attach 后会话指向的页面与桌面版 UI 一致（同一套 React 组件），`browser.$()`、CO 方法可共用。

### 7.2 需要平台分支的部分

| 模块 | 桌面 Chrome e2e | 鸿蒙 attach |
|------|-----------------|-------------|
| `test/lib/testbed.ts` `setup()` | 清本机 metadata、打开 `localhost:5173` | 设备沙箱路径、`fileAccess:persist`、**不** `browser.url(5173)` |
| `Page.open()` | `browser.url(resolveUiPageUrl())` | 改为等待 `window._smm_status === 'ready'`（应用已自载 `18081`） |
| 媒体目录导入 | 本机 `setupTestMediaFolders()` | 需设备侧目录 + 权限 persist |
| MCP / 部分 AI 用例 | 可用 | 视鸿蒙裁剪功能，见 [faq-harmonyos.md](../../docs/superpowers/reference/faq-harmonyos.md) |

建议结构：

```text
apps/e2e/
  test/specs/              # 共享
  test/lib/testbed/
    index.ts               # 对外 API
    desktop.ts             # 现有逻辑
    ohos.ts                # 鸿蒙 setup/cleanup
  wdio.conf.ts             # Chrome + dev server
  electron/wdio.conf.ts    # Windows 安装包
  ohos/wdio.conf.ts        # 鸿蒙 attach
```

在 `ohos/wdio.conf.ts` 的 `before`/`after` 中调用 `testbed/ohos.ts`，spec 文件保持不变。

### 7.3 暂不适合在鸿蒙跑的用例

- 依赖 `yt-dlp`、视频转码、字幕等已在鸿蒙 UI 隐藏的能力
- 强依赖本机 CLI 端口或 Docker 内网环境的用例（需改为设备可访问的后端）

---

## 8. 验证清单（建议按顺序执行）

按下列顺序可确认「鸿蒙 WDIO 链路」是否打通：

1. [ ] HAP（含 `--remote-debugging-port=9222`）已安装到设备
2. [ ] `hdc list targets` 可见设备
3. [ ] `hdc fport tcp:9222 tcp:9222` 已执行
4. [ ] 应用已启动，主界面可见
5. [ ] `curl http://127.0.0.1:9222/json/version` 返回 JSON
6. [ ] 首次运行会下载 Chromedriver 132 到 `~/wdio-cache`（`browserVersion: '132'`）
7. [ ] `pnpm wdio:ohos:hello`（或等价命令）**1 passing**
8. [ ] 日志中打印出非空 `window title`

第 1–5 步通过即说明 **OH remote debugging + 端口转发** 正常；第 6–8 步通过即说明 **WDIO attach** 正常。

---

## 9. 常见问题

### `curl :9222/json/version` 连接失败

- 确认 HAP 是否包含 `--remote-debugging-port=9222` 且已重新安装
- 确认 `hdc fport` 是否建立、应用是否已启动
- 确认防火墙未占用本机 9222

### Chromedriver 版本不匹配

典型报错：`session not created: This version of ChromeDriver only supports Chrome version XXX`

处理：确认 `ohos/wdio.conf.ts` 的 `browserVersion` 为 `'132'`，并清空/避免指向其它版本的 `wdio:chromedriverOptions.binary`；让 WDIO 从 `WDIO_CACHE_DIR` 解析 132 对应 driver。

### `debuggerAddress` 连接成功但找不到元素

- attach 时可能连到 DevTools 列表中的非主窗口 target；可用 `curl http://127.0.0.1:9222/json/list` 查看页面列表
- 等待 `window._smm_status === 'ready'` 后再操作 DOM
- 鸿蒙窗口尺寸、DPI 与桌面不同，避免写死坐标点击

### WDIO 报 `unrecognized chrome option: prefs`

attach 到已有实例时，WDIO 可能注入多余 `chromeOptions`。可设置 `wdio:enforceWebDriverClassic: true`，并避免在 capabilities 里加 `binary` / `prefs`。参见 [WebdriverIO #14591](https://github.com/webdriverio/webdriverio/issues/14591)。

### `hdc fport` 已存在

先 `hdc fport rm tcp:9222 tcp:9222` 再重新 `fport`，或在 `onPrepare` 里捕获错误忽略。

### 与 Windows `wdio:electron:hello` 的区别

| | Windows `electron/` | 鸿蒙 `ohos/` |
|--|---------------------|--------------|
| 启动应用 | WDIO service 启动 `SMM.exe` | 设备上先运行 HAP，WDIO 只 attach |
| 驱动 | `wdio-electron-service` + Electron 39 对应 Chromedriver | 纯 Chromedriver + `debuggerAddress` |
| Chromium | ~142（随桌面 Electron） | **132**（openharmony-sig） |

两套 smoke 都通过，才表示「桌面 Electron 链路」与「鸿蒙 attach 链路」分别可用；**不能**用同一 `wdio.conf.ts` 兼管两者。

---

## 10. 安全提醒

- `--remote-debugging-port` 允许任意连接方控制渲染进程，**仅限受信任网络与测试包**
- 勿在发布到应用市场的 HAP 中保留该开关
- 测试结束后可 `hdc fport rm` 并卸载测试包

---

## 11. 相关文件索引

| 路径 | 说明 |
|------|------|
| `apps/ohos/web_engine/.../CommandLineAdapter.ets` | Electron 命令行参数 |
| `apps/ohos/src/paths.ts` | `MAIN_HTTP_ORIGIN`（`http://127.0.0.1:18081`） |
| `apps/ohos/AppScope/app.json5` | `bundleName` |
| `apps/e2e/electron/` | Windows 安装包 Electron smoke |
| `apps/e2e/test/lib/testbed.ts` | 桌面 e2e 环境准备（鸿蒙需 fork） |
| `docs/superpowers/reference/faq-harmonyos.md` | 鸿蒙平台差异 FAQ |

---

## 12. 后续工作（仓库内尚未实现）

验证本文时，你可能需要自行添加（或提交 PR）：

- [ ] `apps/e2e/ohos/wdio.conf.ts`
- [ ] `apps/e2e/ohos/hello.attach.e2e.ts`
- [ ] `package.json` 脚本 `wdio:ohos:hello`
- [ ] 测试 HAP 中的 `--remote-debugging-port` 开关（建议用 build flavor 控制）
- [ ] `test/lib/testbed/ohos.ts`（复用完整 spec 时）

完成 §8 验证清单后，即可开始将单个 spec 迁到鸿蒙 attach 配置下试跑。
