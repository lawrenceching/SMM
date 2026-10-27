# Download Video Dialog (DVD)

SMM 的视频下载对话框，基于 yt-dlp，支持 YouTube、Bilibili 及所有 yt-dlp 兼容网站。

## 1. UI Flow

### 1.1 Initial State

URL 输入框 + Go 按钮。平台检测沿用 URL 匹配逻辑。

**Bilibili**: 不需要 Cookies，直接显示 URL 输入框。

**YouTube**: 必须提供 Cookies。"使用 Cookies" 和 "从浏览器获取" 至少勾选一个。

### 1.2 Format & Playlist Fetching

`yt-dlp -J [url]` 一次性拉取格式 + 播放列表数据。移除了多余的"下载分集"和"获取视频列表"勾选框。

- `yt-dlp -J` 对所有 URL 类型（Bilibili 系列/合集、YouTube 播放列表等）返回 `PlaylistMetadata`
- entries 中已包含完整视频列表，无需二次请求

### 1.3 Download Execution

用户点击 Start → `POST /api/download-video`，每个选中的 URL 各启动一个下载任务。

格式拉取成功后出现「下载字幕」勾选框。勾选后对话框调用 `POST /api/ytdlp-list-subs`（`yt-dlp --list-subs`，沿用当前 Cookies、代理和 JS 运行时）拉取可用语言，语言为多选。开始下载时，选中的语言随每次 `download-video` 传给 yt-dlp：手动字幕加 `--write-subs`，自动字幕加 `--write-auto-subs`，同一种语言两边都有时两个参数都加，并带 `--sub-langs`。未勾选或未选择语言时不传这些参数。播放列表里每条下载使用同一组语言。

下载任务在后台执行（支持进度显示、暂停、恢复）。

## 2. URL Validation

**Before**: 硬编码 `ALLOWED_HOSTNAMES` 白名单（仅 YouTube + Bilibili）  
**After**: 仅校验 URL 格式（http/https），将网站支持检测交给 yt-dlp 的 `-J` 命令

不支持的网站由 `classifyYtdlpError` 识别并显示友好提示。

## 3. Proxy Configuration

DVD "More options" 底部添加代理服务器输入框。代理值持久化到 `UserConfig.ytdlpProxy`，应用于 list-formats、list-subs 和 download。

同一区域还有 POT Provider URL，持久化到 `UserConfig.ytdlpPotProviderUrl`。非空时，inspect、list-subs 和 download 都会加上 `--extractor-args youtubepot-bgutilhttp:base_url=<url>`。这对应 [bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) 的 HTTP 服务（默认 `http://127.0.0.1:4416`）。yt-dlp 需要另行安装该插件；只填 URL 不会安装插件。

yt-dlp 参数: `--proxy URL`，支持 HTTP/HTTPS/SOCKS。

"More options" 在拉取格式前显示 JS 运行时、代理和 POT Provider URL；拉取格式后显示完整内容（JS 运行时、代理、POT Provider URL、Cookies、Extra args）。

## 4. Cookie Guide URL Speedtest

DVD "Guide & tutorial" 链接使用网络测速动态选择较快镜像（GitHub vs GitCode）。

启动时 `POST /api/speedtest` 并排测速两个 URL，结果写入 localStorage，DVD 组件读取。

## 5. Test URL

CLI 拦截 `https://test.local` URL 用于开发测试，模拟 yt-dlp 错误流程：

```
https://test.local?extractor=youtube&status_code=412
```

不调用真实 yt-dlp，通过 bash 内联输出模拟错误消息并退出码 1。

## 6. Backward Compatibility

- `validateDownloadUrl` 不再检查 hostname — 所有 http/https URL 均可输入
- `UserConfig.ytdlpProxy` 新增字段，不影响旧配置
- 移除的 UI 元素（分集/视频列表勾选框）：功能已内聚到单次 `-J` 调用
- 字幕语言是可选参数。旧客户端不传 `subtitleLangs` 时，下载行为与以前相同
