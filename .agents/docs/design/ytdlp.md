# 支持下载 Youtube 视频

DownloadVideoDialog(DVD) 现在支持下载 bilibili 和 youtube 视频
但UI设计流程与实际需求不一致

请改成以下逻辑

## 1. 初始状态

初始状态下, DVD 显示 URL 输入框和 Go 按钮.

用户通过点击 "Go" 按钮或按回车键触发拉取视频格式.

平台检测 (YouTube / Bilibili) 沿用现有 URL 匹配逻辑, 无需额外处理.

### UI 布局 - Bilibili

Bilibili 不需要 Cookies, 初始状态直接显示 URL 输入框.

```
|------------------------------------------------|
| URL: <input>                           [ Go ]  |
|------------------------------------------------|
|                               | Cancel | Start |
|------------------------------------------------|
```

### UI 布局 - Youtube

Youtube 必须提供 Cookies. "使用 Cookies" 和 "从浏览器获取" 至少勾选一个, 可以同时勾选.

如果两个都未勾选, "Go" 按钮禁用.

**注意:** `--cookies-from-browser` 在 **Windows** 上不支持 Chrome/Edge. 在 Windows 上, 浏览器下拉菜单需要过滤掉 Chrome 和 Edge, 只保留 Firefox. 在 macOS/Linux 上保留全部浏览器选项.

Cookies 参数在拉取格式前显示在顶层; 拉取格式完成后移入 "更多选项".

```
|------------------------------------------------|
| URL: <input>                           [ Go ]  |
| [ ] 使用 Cookies [配置]                         |
| [ ] 从浏览器获取  [Firefox▼]                    |
|------------------------------------------------|
|                               | Cancel | Start |
|------------------------------------------------|
```

## 2 获取视频可下载信息

用户点击 "Go" 按钮或按回车键触发拉取视频格式.

### 2.1 触发方式

- 点击 "Go" 按钮
- 在 URL 输入框中按回车键

不再使用 URL blur 自动触发.

### 2.2 加载状态

拉取视频格式期间, "Go" 按钮文字替换为 Spinner 图标以表示 loading 状态.

使用 `useListFormatsMutation` 管理拉取状态.

### 2.3 调用 yt-dlp

调用 `ytdlp --list-formats` 获取可下载格式.

- `docs\ytdlp\list-format-example-youtube.txt` 文件提供了 Youtube 视频格式的输出样例
- `docs\ytdlp\list-formats-example.txt` 文件提供了 Bilibili 视频格式的输出样例

### 2.4 Cookies

使用 `--cookies-from-browser` 或者 `--cookies`.

特别地, `--cookies-from-browser` 在 **Windows** 上不支持 Chrome/Edge 选项.
浏览器下拉菜单需要根据平台动态过滤:
- Windows: 只保留 Firefox
- macOS / Linux: 保留 Chrome, Edge, Firefox

### 2.5 JS Runtime

yt-dlp 需要 JavaScript Runtime 来解析视频格式.

按照 https://github.com/yt-dlp/yt-dlp/wiki/ejs, yt-dlp 支持 Deno, Node.js, Bun, 和 QuickJS.

在 "更多选项..." 中添加 "JS运行时" checkbox 和下拉菜单, 默认选项为 QuickJS.

- **Youtube 视频:** "JS运行时" checkbox 强制勾选, 用户不可取消, 但可以通过下拉菜单选择不同的运行时.
- **其他视频:** 用户可以随意勾选/取消或选择不同运行时.

## 2.6 拉取格式后 - Cookies 移入 "更多选项"

拉取视频格式成功后, Cookies 参数从顶层移入 "更多选项" 区域 (与 JS运行时、写入缩略图等并列).

## 3 展示视频格式

获取视频格式后, DVD 显示视频格式 Radio Group 和格式码下拉菜单:
* **预设** (已实现) — 通过预设选择视频质量
* **格式码** (未实现) — `--list-formats` 输出的详细格式列表

```
|------------------------------------------------|
| URL: <input>                           |  Go   |
| 视频格式 o 预设 o 格式码                         |
| [ 格式码 ▼                                    ] |
|------------------------------------------------|
|                               | Cancel | Start |
|------------------------------------------------|
```

### 3.1 格式码分类

格式码显示全部格式, 分为 3 类:
1. **audio only** — 仅音频
2. **video only** — 仅视频
3. **audio + video** — 同时包含音视频 (未标注 audio only 和 video only 的格式)

### 3.2 补充格式选择

当用户选择 audio only 格式时, DVD 额外显示一个视频格式码下拉菜单用于补充视频.

当用户选择 video only 格式时, DVD 额外显示一个音频格式码下拉菜单用于补充音频.

补充下拉菜单没有默认选择, 用户可自由选择任意格式组合.

```
|------------------------------------------------|
| URL: <input>                           |  Go   |
| 视频格式 o 预设 o 格式码                         |
| [ 格式码            ▼                        ] |
| [ 格式码 (音频/视频) ▼                        ] |
|------------------------------------------------|
|                               | Cancel | Start |
|------------------------------------------------|
```

### 3.3 分集/集合下载

分集/集合下载场景只支持通过预设选择视频质量, 此时隐藏格式码下拉菜单和视频格式 radio group (不显示提示信息).

## 4 错误处理

以下错误处理同时适用于 `--list-formats` (拉取格式) 和实际下载阶段.

### 4.1 Cookie 过期

当 yt-dlp 输出包含 `The provided YouTube account cookies are no longer valid` 时,
DVD 显示错误信息 **"Cookies 过期或无效, 请重新配置"**.

错误信息样例
```
$ ./yt-dlp.exe --list-formats ‘https://www.youtube.com/watch?v=xIGCEKtobd4’ --js-runtimes ‘quickjs:...’ --cookies ‘...txt’
[youtube] Extracting URL: https://www.youtube.com/watch?v=xIGCEKtobd4&pp=ugUHEgVlbi1VUw%3D%3D
[youtube] xIGCEKtobd4: Downloading webpage
WARNING: [youtube] The provided YouTube account cookies are no longer valid.
...
ERROR: [youtube] xIGCEKtobd4: Sign in to confirm you’re not a bot.
```

### 4.2 请求格式不可用

当 yt-dlp 输出包含 `Requested format is not available` 时,
DVD 显示错误信息 **"请求格式不可用, 请尝试选择格式码"**.

```
ERROR: [youtube] Ex2Z9kHufxU: Requested format is not available. Use --list-formats for a list of available formats
```

### 4.3 其他错误

无法识别的错误类型, 显示 **"未知错误, 请从状态栏任务列表中查看详细日志"**.

## 5 打包 QuickJS

由于解析 Youtube 视频格式强制要求 JS Runtime,
SMM 需要打包 QuickJS 到安装包, 跟 SMM 主体一起发布.

### 5.1 下载 QuickJS

从 https://bellard.org/quickjs/binary_releases/ 下载 QuickJS 二进制文件压缩包.

SMM 需要打包 5 个平台: Windows (x64, arm64), Linux (x64, arm64), macOS (arm64).

| Platform | Package |
|----------|---------|
| Windows x64 | https://bellard.org/quickjs/binary_releases/quickjs-win-x86_64-2025-09-13.zip |
| Linux x64 | https://bellard.org/quickjs/binary_releases/quickjs-linux-x86_64-2025-09-13.zip |
| Windows arm64 | https://bellard.org/quickjs/binary_releases/quickjs-cosmo-2025-09-13.zip |
| Linux arm64 | https://bellard.org/quickjs/binary_releases/quickjs-cosmo-2025-09-13.zip |
| macOS arm64 | https://bellard.org/quickjs/binary_releases/quickjs-cosmo-2025-09-13.zip |

**说明:** `quickjs-cosmo` 是 αcτµαlly pδrταblε εxεcµταblε 格式的单一二进制文件, 可在 Windows arm64、Linux arm64 和 macOS 上运行.

### 5.2 压缩包文件结构

```
quickjs-win-x86_64-2025-09-13.zip
  |-- quickjs-win-x86_64-2025-09-13/  // 文件夹
        |-- libwinpthread-1
        |-- qjs.exe                    // Windows 可执行文件
        |-- *                          // 可能有其他文件, 一并打包

quickjs-linux-x86_64-2025-09-13.zip
  |-- quickjs-linux-x86_64-2025-09-13/
        |-- qjs                        // Linux 可执行文件
        |-- *

quickjs-cosmo-2025-09-13.zip
  |-- quickjs-cosmo-2025-09-13/
        |-- qjs                        // 可执行文件 (cosmo 格式)
        |-- *
```

### 5.3 打包路径

所有文件提取到 `bin/quickjs/` (扁平结构, 不保留版本号子目录).

参考 yt-dlp 和 ffmpeg, 打包到 `[Electron Resource Path]/bin/quickjs/`.

### 5.4 CI 集成

- 修改 `ci/download-3pp-binary.sh`, 新增 QuickJS 下载和提取逻辑
- 修改 `apps/electron/electron-builder.yml`, 新增 `bin/quickjs` 到 `extraResources`
