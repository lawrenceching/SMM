# DownloadVideoDialog 测试用例

> 文档版本: 1.2  
> 对应组件: `apps/ui/src/components/dialogs/download-video-dialog/`  
> 测试框架: WebdriverIO 9 (E2E) + Vitest (Unit)  
> E2E 组件对象: `apps/e2e/test/componentobjects/DownloadVideoDialog.co.ts`  
> 单元测试: `apps/ui/src/components/dialogs/download-video-dialog.test.tsx`

**覆盖方式图例**

| 标记 | 含义 |
|------|------|
| E2E | 通过 WebdriverIO 端到端测试覆盖 |
| Unit | 通过 Vitest 单元测试覆盖 |
| Both | 同时通过 E2E 和单元测试覆盖 |
| — | 尚未通过自动化测试覆盖 |

---

## 目录

1. [组件概述](#1-组件概述)
2. [测试环境准备](#2-测试环境准备)
3. [UI 区域划分与 data-testid 清单](#3-ui-区域划分与-data-testid-清单)
4. [测试用例](#4-测试用例)
   - [4.1 用户协议流程](#41-用户协议流程)
   - [4.2 URL 输入与格式探测](#42-url-输入与格式探测)
   - [4.3 格式选择](#43-格式选择)
   - [4.4 Cookies 配置](#44-cookies-配置)
   - [4.5 剧集下载](#45-剧集下载)
   - [4.6 合集下载](#46-合集下载)
   - [4.7 更多选项](#47-更多选项)
   - [4.8 下载文件夹选择](#48-下载文件夹选择)
   - [4.9 实际下载执行](#49-实际下载执行)
   - [4.10 UI 交互边界](#410-ui-交互边界)
5. [测试数据依赖](#5-测试数据依赖)
6. [环境变量与配置](#6-环境变量与配置)

---

## 1. 组件概述

### 1.1 功能描述

DownloadVideoDialog 是一个视频下载对话框，支持从 **YouTube** 和 **Bilibili** 下载视频。包含以下核心功能：

- 用户协议确认（首次使用时）
- URL 输入与格式探测（`yt-dlp -J`）
- 格式预设选择（默认、最佳画质、1080p、720p、仅音频）
- 格式码选择（精确指定 video/audio/combined 格式码）
- Cookies 配置（手动输入 / 从浏览器提取）
- 剧集下载（Bilibili 剧集列表）
- 合集下载（Bilibili 合集/收藏夹）
- 更多选项（缩略图、元数据、JS Runtime）
- 下载文件夹选择

### 1.2 组件层级

```
DownloadVideoDialog                   ← 入口组件 (index.tsx)
  └── DownloadVideoDialogContent      ← 状态管理层
        └── UIDownloadVideoDialogContent  ← 纯 UI 组件
              ├── AgreementSection
              ├── UrlInputSection
              ├── CookiesSection          (格式探测前)
              ├── FormatSection           (格式探测后)
              ├── EpisodesSection         (Bilibili)
              ├── CollectionSection       (Bilibili 合集)
              ├── MoreOptionsSection
              │     ├── CookiesSection    (格式探测后移入)
              │     ├── JS Runtime
              │     └── Extra Args
              └── FolderSection
```

### 1.3 核心数据流

```
用户输入 URL
  → validateDownloadUrl()  validates
  → 点击 Go 按钮
    → [YouTube] fetchDiscoverExecutables() 检查 QuickJS
    → listYtdlpFormats() 列出可用格式
    → 渲染 FormatSection / 将 CookiesSection 移入 MoreOptions
  → [Bilibili 剧集] 勾选 Download Episodes → fetchEpisodesMetadata()
  → [Bilibili 合集] 勾选 Get Videos → fetchCollectionMetadata()
  → 点击 Start 按钮
    → buildDownloadVideoJob() 构建后台任务
    → createJob() 入队
    → 关闭对话框
```

---

## 2. 测试环境准备

### 2.1 `beforeEach` 标准设置

```typescript
beforeEach(async () => {
    await setup({
        removeMetadataDir: true,
        removePlansDir: true,
        removeMediaFolders: true,
        removeDirInSidebar: true,
        openBrowserPage: true,
        resetUserConfig: true,
        clearLocalStorage: true,
    })
})
```

### 2.2 `afterEach` 标准清理

```typescript
afterEach(async () => {
    await cleanup({
        removeMetadataDir: true,
        removePlansDir: true,
        removeMediaFolders: true,
        removeDirInSidebar: true,
        resetUserConfig: true,
        clearLocalStorage: true,
    })
})
```

### 2.3 媒体文件夹准备

所有下载测试需要在 music 类型的媒体文件夹中执行：

```typescript
const folder = await createAndImportFolder({
    folderName: "BilibiliMusic",
    type: "music",
    files: [],
}, "e2eTest:MusicPanel-Download:<用例名称>")
```

### 2.4 组件对象导入

```typescript
import MusicPanel from "test/componentobjects/MusicPanel.co"
import DownloadVideoDialogCO from "test/componentobjects/DownloadVideoDialog.co"
import {
    countVideoFilesInFolder,
    hasPartialDownloads,
    waitForFolderVideosReady,
} from "test/lib/download-folder"
```

---

## 3. UI 区域划分与 data-testid 清单

| data-testid | 对应 UI 元素 | 所属 Section |
|---|---|---|
| `download-video-dialog` | Dialog 容器 | — |
| `download-video-dialog-agreement-checkbox` | 用户协议勾选框 | AgreementSection |
| `download-video-dialog-url-input` | URL 输入框 | UrlInputSection |
| `download-video-dialog-go-button` | Go 按钮（格式探测） | UrlInputSection |
| `download-video-dialog-listing-error` | 格式探测错误提示 | UrlInputSection |
| `download-video-dialog-quickjs-unavailable` | QuickJS 不可用错误 | UrlInputSection |
| `download-video-dialog-use-cookies-checkbox` | 使用 Cookies | CookiesSection |
| `download-video-dialog-cookies-button` | 配置 Cookies 按钮 | CookiesSection |
| `download-video-dialog-use-cookies-from-browser-checkbox` | 从浏览器提取 Cookies | CookiesSection |
| `download-video-dialog-cookies-browser-select` | 浏览器选择器 | CookiesSection |
| `download-video-dialog-1080p-auth-hint` | 1080p 需要认证提示 | CookiesSection |
| `download-video-dialog-cookies-required-hint` | YouTube 需要 Cookies 提示 | CookiesSection |
| `download-video-dialog-format-mode-preset` | 格式模式：预设 | FormatSection |
| `download-video-dialog-format-mode-code` | 格式模式：格式码 | FormatSection |
| `download-video-dialog-format-select` | 格式预设选择器 | FormatSection |
| `download-video-dialog-format-option-{id}` | 格式预设选项 | FormatSection |
| `download-video-dialog-format-code-select` | 格式码选择器 | FormatSection |
| `download-video-dialog-supplementary-format-code-select` | 补充格式码选择器 | FormatSection |
| `download-video-dialog-episodes-checkbox` | 下载剧集勾选框 | EpisodesSection |
| `download-video-dialog-episodes-panel` | 剧集列表面板 | EpisodesSection |
| `download-video-dialog-episodes-list` | 剧集列表 | EpisodesSection |
| `download-video-dialog-episodes-list-item` | 单集条目 | EpisodesSection |
| `download-video-dialog-episode-checkbox-{url}` | 单集勾选框 | EpisodesSection |
| `download-video-dialog-get-videos-checkbox` | 获取合集视频勾选框 | CollectionSection |
| `download-video-dialog-collection-panel` | 合集视频列表面板 | CollectionSection |
| `download-video-dialog-collection-list` | 合集视频列表 | CollectionSection |
| `download-video-dialog-collection-list-item` | 合集视频条目 | CollectionSection |
| `download-video-dialog-collection-checkbox-{url}` | 合集视频勾选框 | CollectionSection |
| `download-video-dialog-more-options-checkbox` | 更多选项勾选框 | MoreOptionsSection |
| `download-video-dialog-use-js-runtime-checkbox` | 使用 JS Runtime | MoreOptionsSection |
| `download-video-dialog-js-runtime-select` | JS Runtime 选择器 | MoreOptionsSection |
| `download-video-dialog-write-thumbnail-checkbox` | 下载缩略图 | MoreOptionsSection |
| `download-video-dialog-embed-thumbnail-checkbox` | 嵌入缩略图 | MoreOptionsSection |
| `download-video-dialog-embed-metadata-checkbox` | 嵌入元数据 | MoreOptionsSection |
| `download-video-dialog-folder-input` | 下载文件夹输入框 | FolderSection |
| `download-video-dialog-folder-picker` | 文件夹选择按钮 | FolderSection |
| `download-video-dialog-cancel` | 取消按钮 | DialogFooter |
| `download-video-dialog-start` | 开始下载按钮 | DialogFooter |

---

## 4. 测试用例

### 4.1 用户协议流程

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 | 覆盖方式 |
|---|---------|---------|---------|---------|------|---------|
| **TC-AG-01** | 新用户打开对话框时显示协议 | localStorage 未设置 `userAgreed` | 1. 点击 MusicPanel 下载按钮<br>2. 等待对话框打开 | 1. 协议区域可见，包含标题和说明文字<br>2. URL 输入框、文件夹输入框、Start 按钮均处于禁用状态 | 功能 | Both |
| **TC-AG-02** | 勾选协议后启用控件 | localStorage 未设置 `userAgreed` | 1. 勾选同意复选框<br>2. 观察控件状态 | 1. 协议区域从 DOM 中移除<br>2. URL 输入框和文件夹输入框变为可用<br>3. localStorage 写入 `DownloadVideoDialog.userAgreed = true` | 功能 | Both |
| **TC-AG-03** | 已同意用户跳过协议 | localStorage 已设置 `userAgreed = true` | 1. 点击下载按钮<br>2. 等待对话框打开 | 1. 协议区域不显示<br>2. URL 和文件夹输入框默认可用 | 功能 | Both |
| **TC-AG-04** | 未勾协议时 Start 按钮无反应 | 对话框刚打开 | 1. 输入 URL<br>2. 输入文件夹<br>3. 点击 Start | 后台任务未被创建，对话框保持打开 | 功能 | Both |
| **TC-AG-05** | 取消/重置后重新打开保留协议状态 | 已勾选过协议并关闭对话框 | 1. 重新打开对话框 | 协议仍然不显示，控件可用 | 回归 | E2E |

### 4.2 URL 输入与格式探测

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 | 覆盖方式 |
|---|---------|---------|---------|---------|------|---------|
| **TC-URL-01** | 输入有效 URL 后 Go 按钮可点击 | 已同意协议 | 1. 在 URL 输入框输入 `https://www.youtube.com/watch?v=dQw4w9WgXcQ`<br>2. 点击 Go 按钮 | 1. Go 按钮显示 Spinner 旋转<br>2. 格式探测 API 被调用<br>3. 格式选择区域出现<br>4. Cookies 区域移入 More Options | 功能 | E2E |
| **TC-URL-02** | 输入无效 URL 时显示验证错误 | 已同意协议 | 1. 输入 `not-a-valid-url`<br>2. 点击 Go 按钮 | 1. URL 输入框显示红色边框<br>2. 错误提示文字出现<br>3. 格式探测不被调用 | 功能 | E2E |
| **TC-URL-03** | 回车键触发 Go | 已同意协议 | 1. 输入有效 URL<br>2. 按 Enter 键 | 等价于点击 Go 按钮，格式探测被触发 | 功能 | E2E |
| **TC-URL-04** | Go 在探测中时禁用 | 格式探测正在进行 | 1. 点击 Go<br>2. 等待期间再次点击 Go | 第二次点击无效，Go 按钮处于禁用状态 | 功能 | E2E |
| **TC-URL-05** | 格式探测失败时显示错误 | 已同意协议 | 1. 输入一个会导致探测失败的 URL<br>2. 点击 Go | 1. 红色错误提示显示在 URL 下方<br>2. FormatSection 不渲染<br>3. Cookies 保持在顶部 | 异常 | E2E |
| **TC-URL-06** | 更改 URL 时重置格式探测结果 | 已获取过一次格式 | 1. 输入 URL-A，点击 Go，获取格式<br>2. 将 URL 改为 URL-B | 格式选择区域消失，Cookies 移回顶部，之前的格式数据被清除 | 功能 | E2E |
| **TC-URL-07** | YouTube URL 需要先检查 QuickJS | 已同意协议 | 1. 输入 YouTube URL<br>2. 点击 Go | 先调用 `fetchDiscoverExecutables()` 检查 QuickJS 可用性，不可用时显示错误 | 功能 | E2E |
| **TC-URL-08** | QuickJS 不可用时显示错误并禁用 Start | QuickJS 未安装 | 1. 输入 YouTube URL<br>2. 勾选 From browser<br>3. 点击 Go | 1. 显示 QuickJS 不可用错误提示<br>2. Start 按钮被禁用 | 异常 | Unit |
| **TC-URL-09** | 非 YouTube URL 不检查 QuickJS | 已同意协议 | 1. 输入 Bilibili URL<br>2. 点击 Go | QuickJS 检查不被触发 | 功能 | E2E |

> **TC-URL-08** 由单元测试覆盖（参见 `download-video-dialog.test.tsx` → `DownloadVideoDialog - QuickJS availability check`）。

### 4.3 格式选择

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 | 覆盖方式 |
|---|---------|---------|---------|---------|------|---------|
| **TC-FMT-01** | 默认格式预设选中 default | 格式探测成功 | 查看格式选择器 | 默认选中 `Default (automatic)` | 功能 | Unit |
| **TC-FMT-02** | 切换格式预设（例如 1080p） | 格式探测成功 | 1. 打开格式选择器<br>2. 选择 `1080p` | 1. 选择器显示 1080p<br>2. 传入后台任务的 ytdlpFormat 对应更新 | 功能 | Unit |
| **TC-FMT-03** | 1080p 不可用时显示 unavailable 标记 | 探测返回格式不含 1080p | 1. 打开格式选择器 | `1080p` 选项显示 `(unavailable)` 后缀 | 功能 | Unit |
| **TC-FMT-04** | 1080p 不可用且无 Cookies 时 Start 禁用 | 探测结果不含 1080p，未配置 Cookies | 1. 选择 1080p<br>2. 查看 Start | Start 按钮被禁用，显示 1080p 需要认证提示 | 功能 | Unit |
| **TC-FMT-05** | 1080p 不可用但有 Cookies 时 Start 可用 | 探测结果不含 1080p，已开启 From Browser | 1. 在 More Options 中勾选 From browser<br>2. 选择 1080p<br>3. 查看 Start | Start 按钮可用 | 功能 | Unit |
| **TC-FMT-06** | 探测失败时 1080p 视为可用 | 格式探测未执行或失败 | 1. 选择 1080p | Start 按钮仍然可用（failsafe） | 功能 | Unit |
| **TC-FMT-07** | 切换到格式码模式 | 格式探测成功 | 1. 点击 Format code radio<br>2. 查看格式码选择器 | 1. 格式码下拉框出现<br>2. 格式码分组合并、仅音频、仅视频显示 | 功能 | Unit |
| **TC-FMT-08** | 选择音频格式码时显示补充视频选项 | 格式码模式，选中音频码 | 1. 切换到 Format code 模式<br>2. 选择一个 audio-only 格式码 | 补充格式码选择器出现，列出 video-only 选项 | 功能 | Unit |
| **TC-FMT-09** | 选择视频格式码时显示补充音频选项 | 格式码模式，选中视频码 | 1. 切换到 Format code 模式<br>2. 选择一个 video-only 格式码 | 补充格式码选择器出现，列出 audio-only 选项 | 功能 | Unit |
| **TC-FMT-10** | 选择 combined 格式码时不显示补充选项 | 格式码模式，选中 combined 码 | 1. 选择一个 combined 格式码 | 补充格式码选择器不出现 | 功能 | Unit |
| **TC-FMT-11** | 剧集/合集模式下隐藏格式码 UI | 勾选 Download episodes 或 Get videos | 1. 选中剧集或合集<br>2. 查看格式区域 | 格式区域被隐藏（`hideFormatCodeUi = true`） | 功能 | Unit |

### 4.4 Cookies 配置

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 | 覆盖方式 |
|---|---------|---------|---------|---------|------|---------|
| **TC-CK-01** | 勾选 Use cookies 后显示 Configure 按钮 | 已同意协议 | 1. 勾选 `Use cookies` | 1. Configure 按钮可点击<br>2. 提示文字变为 `cookiesNotProvided` | 功能 | Unit |
| **TC-CK-02** | 点击 Configure 打开文本编辑器 | 已勾选 Use cookies | 1. 点击 Configure 按钮 | 1. 文本编辑对话框打开<br>2. 标题、描述、标签正确显示<br>3. 可输入 Netscape cookie 文本 | 功能 | Unit |
| **TC-CK-03** | 确认编辑后 cookiesText 更新 | 文本编辑器打开 | 1. 输入 cookie 文本<br>2. 点击确认 | 1. 文本编辑器关闭<br>2. Use cookies 保持勾选<br>3. cookiesNotProvided 提示消失 | 功能 | Unit |
| **TC-CK-04** | 勾选 From browser 后显示浏览器选择器 | 已同意协议 | 1. 勾选 `From browser` | 1. 浏览器选择器出现<br>2. 默认选中 `Firefox`（或其他平台可用浏览器） | 功能 | Unit |
| **TC-CK-05** | 切换浏览器选项 | From browser 已勾选 | 1. 打开浏览器选择器<br>2. 选择 `Chrome` | 选择器显示 Chrome | 功能 | Unit |
| **TC-CK-06** | YouTube 需要 Cookies 但未配置时显示错误 | YouTube URL，未勾选 Use cookies 或 From browser | 1. 输入 YouTube URL<br>2. 尝试点击 Go 或 Start | 1. 显示 `cookiesRequiredForYoutube` 错误<br>2. Go 按钮禁用 | 功能 | Unit |
| **TC-CK-07** | 切换域名时 Cookie 缓存恢复 | 已为某域名缓存过 Cookies | 1. 输入 youtube.com URL → 配置 Cookies<br>2. 改输入 bilibili.com URL<br>3. 改回 youtube.com URL | 切换回 youtube.com 时，之前配置的 Cookies 被自动恢复 | 功能 | Unit |
| **TC-CK-08** | 切换到一个无缓存域名时 Cookies 重置 | 已为某域名缓存过 Cookies | 1. 输入 youtube.com URL → 配置 Cookies<br>2. 改输入 bilibili.com URL（无缓存） | Cookies 选项被重置为未勾选 | 功能 | Unit |
| **TC-CK-09** | Use cookies 启用但内容为空时 Start 禁用 | 已勾选 Use cookies 但未输入内容 | 1. 输入有效 URL 和文件夹<br>2. 查看 Start 按钮 | Start 按钮禁用 | 功能 | Unit |
| **TC-CK-10** | 写入 Cookies 文件失败时显示错误 | Use cookies 启用且有内容 | 1. 模拟 cookies 文件写入失败<br>2. 点击 Start | 1. 显示 toast 错误<br>2. 后台任务未被创建 | 异常 | Unit |
| **TC-CK-11** | From browser 未勾选的 URL 不需要 Cookies 也不检查 | 非 YouTube/Bilibili URL | 1. 输入 `https://example.com/video`<br>2. 点击 Go | Cookies 区域不显示，Go 按钮可用 | 功能 | Unit |

**覆盖方式说明**

| 标记 | 含义 |
|------|------|
| E2E | 通过 WebdriverIO E2E 测试覆盖 |
| Unit | 通过 Vitest 单元测试覆盖 (`download-video-dialog.test.tsx`) |
| Both | 同时通过 E2E 和单元测试覆盖 |
| — | 尚未通过自动化测试覆盖 |

### 4.5 剧集下载

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 | 覆盖方式 |
|---|---------|---------|---------|---------|------|---------|
| **TC-EP-01** | Bilibili URL 显示 Download Episodes 复选框 | 已同意协议 | 1. 输入 Bilibili 视频 URL | `Download episodes` 复选框出现 | 功能 | Unit |
| **TC-EP-02** | YouTube URL 不显示 Download Episodes | 已同意协议 | 1. 输入 YouTube 视频 URL | `Download episodes` 复选框不存在 | 功能 | Unit |
| **TC-EP-03** | 勾选 Download episodes 后加载剧集列表 | Bilibili URL | 1. 勾选 `Download episodes` | 1. 剧集列表面板出现<br>2. 显示 Loading 文字<br>3. 加载完成后显示剧集列表<br>4. 所有剧集默认勾选 | 功能 | Unit |
| **TC-EP-04** | 取消勾选时清空剧集列表 | 已加载剧集列表 | 1. 取消勾选 `Download episodes` | 1. 剧集列表被清除<br>2. 复选状态回到未选中 | 功能 | Unit |
| **TC-EP-05** | 可以取消选择个别剧集 | 已加载剧集列表 | 1. 取消勾选某一集的复选框 | 该集从 `selectedEpisodeUrls` 中移除 | 功能 | Unit |
| **TC-EP-06** | 开始下载时按选中的剧集创建单个任务 | 已选择部分剧集 | 1. 选择第 1、2 集<br>2. 点击 Start | 1. 为第 1 集创建一个任务<br>2. 任务包含正确的 `itemMeta`（title, artist） | 功能 | Unit |
| **TC-EP-07** | 所有剧集取消选中后 Start 仅打印警告 | 已选择 0 个剧集 | 1. 取消勾选所有剧集<br>2. 点击 Start | 1. console.warn 被调用<br>2. 后台任务不被创建 | 边界 | Unit |
| **TC-EP-08** | 剧集加载失败时显示错误 | 可返回错误的 URL | 1. 勾选 Download episodes | 1. 显示错误提示文字<br>2. 剧集列表为空 | 异常 | Unit |
| **TC-EP-09** | 剧集请求超时处理 | 请求响应极慢 | 1. 勾选 Download episodes | 显示加载状态直至超时或取消 | 异常 | — |
| **TC-EP-10** | 更改 URL 时清除旧的剧集状态 | 已加载剧集列表 | 1. 为 URL-A 加载剧集列表<br>2. 将 URL 改为 URL-B | 1. Download episodes 恢复为未勾选<br>2. 旧剧集列表被清除 | 功能 | Unit |
| **TC-EP-11** | 忽略过期的剧集元数据响应 | 快速切换 URL | 1. 切 URL 两次<br>2. 旧 URL 的响应在切换后到达 | 旧响应被丢弃，最终列表显示新 URL 的剧集 | 功能 | Unit |
| **TC-EP-12** | 合集 URL 不显示剧集选项 | Bilibili 合集 URL | 1. 输入合集 URL | Download episodes 复选框不出现，Get videos 出现 | 功能 | Unit |

> **TC-EP-09** 超时场景依赖异步时序控制，建议留待手工测试验证。

### 4.6 合集下载

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 |
|---|---------|---------|---------|---------|------|
| **TC-CO-01** | 合集 URL 显示 Get videos 复选框 | 已同意协议 | 1. 输入 Bilibili 合集 URL | `Get videos` 复选框出现 | 功能 |
| **TC-CO-02** | 非合集 URL 不显示 Get videos | 已同意协议 | 1. 输入非合集 Bilibili URL | `Get videos` 复选框不存在 | 功能 |
| **TC-CO-03** | 勾选 Get videos 后加载合集视频列表 | 合集 URL | 1. 勾选 `Get videos` | 1. 合集列表面板出现<br>2. 显示 Loading 文字<br>3. 加载完成后显示视频列表<br>4. 所有视频默认勾选 | 功能 |
| **TC-CO-04** | 合集列表中每个条目显示解析后的标题 | 合集加载成功 | 1. 等待合集列表加载完成 | 每个条目显示对应的视频标题（通过 `getBilibiliVideoMetadata` 解析） | 功能 |
| **TC-CO-05** | 取消勾选时清空合集列表 | 已加载合集 | 1. 取消勾选 `Get videos` | 1. 合集列表被清除<br>2. 复选状态回到未选中 | 功能 |
| **TC-CO-06** | 勾选 Get videos 后才显示 Start 按钮 | 合集 URL | 1. 查看按钮状态 | 未勾选 Get videos 时 Start 按钮不显示 | 功能 |
| **TC-CO-07** | 合集模式下为每个选中的视频创建独立任务 | 已选择部分视频 | 1. 选择前 3 个视频<br>2. 点击 Start | 1. 创建 3 个后台任务<br>2. 任务共享同一个 parentId<br>3. 对话框关闭 | 功能 |
| **TC-CO-08** | 合集列表为空时 Start 按钮不显示 | 合集 URL | 1. 勾选 Get videos<br>2. 合集加载返回 0 个视频 | Start 按钮不存在 | 边界 |
| **TC-CO-09** | 合集加载失败时显示错误和 toast | 合集 URL | 1. 勾选 Get videos<br>2. 加载失败 | 1. 错误提示在面板中显示<br>2. toast 显示错误消息 | 异常 |
| **TC-CO-10** | 合集列表取消全部选择后 Start 禁用 | 合集加载成功 | 1. 取消勾选所有视频<br>2. 查看 Start | Start 按钮禁用 | 边界 |
| **TC-CO-11** | 合集切换 URL 时清除旧合集状态 | 已加载合集 | 1. 为 URL-A 加载合集<br>2. 改为 URL-B | 1. Get videos 恢复未勾选<br>2. 旧合集列表被清除 | 功能 |

### 4.7 更多选项

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 |
|---|---------|---------|---------|---------|------|
| **TC-MO-01** | 展开 More Options 显示所有子选项 | 已同意协议 | 1. 勾选 `More options...` | 1. Write thumbnail 复选框出现<br>2. Embed thumbnail 复选框出现<br>3. Embed metadata 复选框出现 | 功能 |
| **TC-MO-02** | 勾选 Write thumbnail 后 ExtraArgs 包含该参数 | More Options 已展开 | 1. 勾选 `Write thumbnail`<br>2. 点击 Start | 后台任务包含 `ytdlpExtraArgs: ['--write-thumbnail']` | 功能 |
| **TC-MO-03** | JS Runtime 选项 | More Options 已展开 | 1. 勾选 `Use JS Runtime` | 1. JS Runtime 下拉框出现<br>2. 可选择 quickjs 等运行时 | 功能 |
| **TC-MO-04** | YouTube URL 强制启用 JS Runtime | YouTube URL，More Options 已展开 | 1. 输入 YouTube URL | JS Runtime 复选框被勾选且禁用 | 功能 |
| **TC-MO-05** | 格式探测后 Cookies 移入 More Options | 格式探测完成 | 1. 点击 Go 完成格式探测 | Cookies Section 出现在 More Options 内部 | 功能 | Unit |
| **TC-MO-06** | 更多选项中的 Cookies 行为与顶部一致 | Cookies 在 More Options 中 | 1. 勾选 Use cookies<br>2. 点击 Configure<br>3. 输入内容确认 | 行为与 TC-CK-02/03 一致 | 回归 | Unit |

### 4.8 下载文件夹选择

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 |
|---|---------|---------|---------|---------|------|
| **TC-FD-01** | 文件夹输入框显示默认路径 | `destinationFolder` prop 传入 | 1. 打开对话框 | 文件夹输入框显示传入的默认路径 | 功能 |
| **TC-FD-02** | 点击文件夹选择按钮打开系统文件选择器 | 已同意协议 | 1. 点击文件夹图标按钮 | `onOpenFilePicker` 被调用，参数包含 `selectFolder: true` 和当前路径 | 功能 |
| **TC-FD-03** | 选择文件夹后输入框更新 | 文件选择器返回路径 | 1. 选择文件夹 `D:\videos` | 输入框显示 `D:\videos` | 功能 |
| **TC-FD-04** | 文件夹为空时 Start 禁用 | 文件夹输入为空 | 1. 输入有效 URL<br>2. 不填写文件夹<br>3. 查看 Start | Start 按钮禁用 | 功能 |
| **TC-FD-05** | 未同意协议时文件夹选择器禁用 | 未勾选协议 | 1. 查看文件夹选择按钮 | 按钮处于禁用状态 | 功能 |

### 4.9 实际下载执行

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 |
|---|---------|---------|---------|---------|------|
| **TC-DL-01** | 下载单个 Bilibili 视频 | 已创建媒体文件夹 | 1. 打开对话框<br>2. 同意协议<br>3. 输入 Bilibili 视频 URL<br>4. 勾选 Write thumbnail<br>5. 点击 Start<br>6. 等待下载完成 | 1. 目标文件夹包含 `.mp4` 文件和 `.jpg` 文件<br>2. 视频文件名格式正确 | 集成 |
| **TC-DL-02** | 下载 Bilibili 剧集 | 已创建媒体文件夹 | 1. 打开对话框<br>2. 同意协议<br>3. 输入 Bilibili 剧集 URL<br>4. 勾选 Download episodes<br>5. 等待剧集列表加载<br>6. 取消部分剧集<br>7. 点击 Start<br>8. 等待下载完成 | 1. 目标文件夹包含选中的剧集视频<br>2. 不存在未选中的剧集 | 集成 |
| **TC-DL-03** | 下载 Bilibili 合集 | 已创建媒体文件夹 | 1. 打开对话框<br>2. 同意协议<br>3. 输入合集 URL<br>4. 选择 720p 格式<br>5. 勾选 Get videos<br>6. 等待合集列表加载<br>7. 取消部分视频<br>8. 点击 Start<br>9. 等待下载完成 | 1. 目标文件夹包含选中的视频<br>2. 不存在 `.part` 文件（下载已完成）<br>3. 不包含未选中的视频 | 集成 |
| **TC-DL-04** | 下载单个 YouTube 视频 | 已创建媒体文件夹<br>已配置网络代理（如需） | 1. 输入 YouTube URL<br>2. 配置 Cookies<br>3. 点击 Start<br>4. 等待下载完成 | 1. 目标文件夹包含视频文件<br>2. 包含缩略图文件 | 集成 |
| **TC-DL-05** | 下载完成后的视频在 MusicPanel 表格中显示 | 下载完成 | 1. 完成上面任一下载测试后<br>2. 查看 MusicPanel 表格 | 表格中出现对应标题的行 | 集成 |
| **TC-DL-07** | 取消按钮关闭对话框 | 对话框已打开 | 1. 点击 Cancel 按钮 | 1. 对话框关闭<br>2. 重置 hooks 被调用（resetEpisodesMetadata, extractReset 等） | 功能 |

### 4.10 UI 交互边界

| # | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 类型 |
|---|---------|---------|---------|---------|------|
| **TC-UI-03** | 入队失败时显示 toast 并保持对话框打开 | 后台任务创建失败 | 1. 模拟失败<br>2. 点击 Start | 1. toast 显示错误消息<br>2. 对话框保持打开<br>3. Start 按钮恢复可用 | 异常 |
| **TC-UI-07** | 关闭对话框后重置所有状态 | DialogFooter Start 已修改过状态 | 1. 输入 URL、选择格式、配置 Cookies<br>2. 点击 Cancel | 下次打开时所有字段回到初始状态 | 功能 |

---

## 5. 测试数据依赖

### 5.1 需要真实的在线视频 URL（集成测试）

| 类型 | URL | 用途 | 预期内容 |
|------|-----|------|---------|
| Bilibili 视频 | `https://www.bilibili.com/video/BV17NrWBaE87/` | 单视频下载 | 可播放视频（~30MB） |
| Bilibili 剧集 | `https://www.bilibili.com/video/BV1rY4y1P7er/` | 多集视频 | ≥18 集 |
| Bilibili 合集 | `https://space.bilibili.com/651386960/lists/1903590?type=season` | 合集视频 | ≥4 个视频 |
| YouTube 视频 | `https://www.youtube.com/watch?v=2JgVKe64nl0` | YouTube 下载 | 中文视频，含 .mkv + .webp |

### 5.2 模拟数据（单元测试用）

格式探测响应数据结构: `VideoMetadata`

```typescript
{
  id: string
  title: string
  formats: Array<{
    url: string
    ext: string
    format_id: string
    format: string
    height: number
    width: number
    vcodec: string
    acodec: string
    // ...
  }>
}
```

剧集响应数据结构:

```typescript
{
  error: string | null
  videos: Array<{
    id: string
    title: string
    fulltitle: string
    webpage_url: string
    uploader?: string
  }>
}
```

合集响应数据结构:

```typescript
{
  entries: Array<{
    ie_key: string
    id: string
    _type: string
    url: string
  }>
}
```

---

## 6. 环境变量与配置

### 6.1 E2E 环境配置

| 环境变量 | 用途 | 默认值 |
|---------|------|--------|
| `SLOWMO` | 减慢测试执行速度（调试用） | 未设置 |
| `SKIP_UI` | 跳过 UI 操作测试 | 未设置 |
| `DOWNLOAD_DIR` | 下载文件保存路径 | 测试自动创建 |

### 6.2 超时配置

| 测试类型 | 超时时间 | 说明 |
|---------|---------|------|
| 单视频下载 | 2 分钟 | 一般 Bilibili/YouTube 单视频 |
| 剧集下载 | 2 分钟/集 | 多集下载按集数增加 |
| 合集下载 | 5 分钟 | 多视频合集 |
| 剧集列表加载 | 60 秒 | Bilibili 剧集元数据加载 |
| 合集列表加载 | 60 秒 | Bilibili 合集元数据加载 |
| 对话框显示 | 5 秒 | 对话框打开等待 |
| 文件就绪等待 | 90 秒 | 下载完成检测（可配置） |

### 6.3 E2E 测试执行

```bash
# 运行所有下载相关的 E2E 测试
cd apps/e2e
pnpm run wdio --spec ./test/specs/music/MusicPanel-Download.e2e.ts

# 带 slowmo 运行（调试用）
SLOWMO=500 pnpm run wdio --spec ./test/specs/music/MusicPanel-Download.e2e.ts

# 运行单个用例
pnpm run wdio -- --mochaOpts.grep "Download Bilibili Video" ./test/specs/music/MusicPanel-Download.e2e.ts
```

---

## 附录：组件对象 API 参考

| 方法 | 参数 | 说明 |
|------|------|------|
| `setAgreement(checked)` | `boolean` | 勾选/取消用户协议 |
| `setUrl(value)` | `string` | 输入视频 URL |
| `selectVideoFormat(presetId)` | `VideoFormatPresetId` | 选择格式预设 |
| `setUseCookies(checked)` | `boolean` | 启用/禁用 Cookies |
| `setUseCookiesFromBrowser(checked)` | `boolean` | 启用/禁用浏览器 Cookies |
| `selectBrowser(browserId)` | `CookiesBrowserId` | 选择浏览器 |
| `setCookies(text)` | `string` | 打开编辑器并输入 Cookies |
| `setDownloadEpisodes(checked)` | `boolean` | 启用/禁用剧集下载 |
| `setGetVideos(checked)` | `boolean` | 启用/禁集合集下载 |
| `setMoreOptions(checked)` | `boolean` | 展开/收起更多选项 |
| `setWriteThumbnail(checked)` | `boolean` | 启用/禁用写缩略图 |
| `setEmbedThumbnail(checked)` | `boolean` | 启用/禁用嵌入缩略图 |
| `setEmbedMetadata(checked)` | `boolean` | 启用/禁用嵌入元数据 |
| `clickStart()` | — | 点击 Start 按钮（含调试信息） |
| `clickCancel()` | — | 点击 Cancel 按钮 |
| `waitForCollectionListLoaded(opts?)` | `{ minItems, timeout }` | 等待合集列表加载完成 |
| `uncheckCollectionExcept(keepIndices)` | `number[]` | 取消除指定索引外的合集项 |
| `uncheckEpisodesExcept(keepIndices)` | `number[]` | 取消除指定索引外的剧集项 |
| `dumpStartButtonDebugInfo()` | — | 打印 Start 按钮状态（调试用） |

> **组件对象路径**: `apps/e2e/test/componentobjects/DownloadVideoDialog.co.ts`
