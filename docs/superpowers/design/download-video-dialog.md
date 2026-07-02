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

用户点击 Start → `POST /api/executeCmd` 执行 `yt-dlp --print after_move:filepath` → 文件下载到目标目录。

下载任务通过 `JobOrchestratorProvider` 后台执行（支持进度显示、暂停、恢复）。

## 2. URL Validation

**Before**: 硬编码 `ALLOWED_HOSTNAMES` 白名单（仅 YouTube + Bilibili）  
**After**: 仅校验 URL 格式（http/https），将网站支持检测交给 yt-dlp 的 `-J` 命令

不支持的网站由 `classifyYtdlpError` 识别并显示友好提示。

## 3. Proxy Configuration

DVD "More options" 底部添加代理服务器输入框。代理值持久化到 `UserConfig.ytdlpProxy`，应用于 list-formats 和 download 两个阶段。

yt-dlp 参数: `--proxy URL`，支持 HTTP/HTTPS/SOCKS。

"More options" 在拉取格式前显示 JS 运行时 + 代理选项；拉取格式后显示完整内容（JS 运行时、代理、Cookies、Extra args）。

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
