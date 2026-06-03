# yt-dlp 错误码参考文档

> 基于 yt-dlp master 源码 (`yt_dlp/__init__.py`, `yt_dlp/YoutubeDL.py`, `yt_dlp/utils/_utils.py`) 及维护者官方说明整理
> 更新日期: 2026-06-02

---

## 一、CLI 退出码

yt-dlp 维护者 (pukkandan) 在 [Issue #4262](https://github.com/yt-dlp/yt-dlp/issues/4262) 中正式定义了以下退出码：

| 退出码 | 含义 | 说明 |
|---|---|---|
| **0** | 成功 | 所有下载和处理均正常完成 |
| **1** | 通用错误 | 绝大多数错误的退出码：网络错误、提取失败、文件 IO 错误等 |
| **2** | 用户选项错误 | 用户提供的命令行选项无效或不合法 |
| **100** | 需要重启更新 | yt-dlp 已下载更新，需要重启进程以完成更新 |
| **101** | 下载被取消 | 由 `--max-downloads` 等选项触发的主动取消 |

> **注意**: 退出码 0、2、100、101 保证向后兼容，未来不会变更。退出码 1 覆盖范围较广，可能在未来拆分为多个更具体的退出码。

### main() 异常处理映射

| 异常类型 | 触发条件 | 退出码 |
|---|---|---|
| `DownloadError` | 下载/提取过程出错 | 1 |
| `CookieLoadError` | Cookie 加载失败 | 1 |
| `SameFileError` | 输出文件与自身相同（同名覆盖） | 1 |
| `KeyboardInterrupt` | 用户按 Ctrl+C 中断 | 1 |
| `BrokenPipeError` | 管道断裂 | 1 |

---

## 二、异常类层次结构

所有异常均定义于 `yt_dlp.utils._utils`，继承自 `YoutubeDLError`。

```
YoutubeDLError (基类)
├── DownloadError              —— 通用下载错误（网络、默认触发退出码 1）
├── ExtractorError             —— 视频信息提取错误
│   ├── UnsupportedError       —— 不支持的 URL
│   ├── GeoRestrictedError     —— 地理区域限制
│   ├── UserNotLive            —— 主播未开播
├── PostProcessingError        —— 后处理错误（ffmpeg 合并、转换等）
├── SameFileError              —— 输出文件路径与输入相同
├── DownloadCancelled          —— 下载被主动取消（退出码 101）
├── MaxDownloadsReached        —— 达到 --max-downloads 上限
├── RejectedVideoReached       —— 视频被 --match-filter 等条件拒绝
├── EntryNotInPlaylist         —— 指定的播放列表条目不存在
├── ExistingVideoReached       —— 存档中已存在的视频（--break-on-existing）
├── UnavailableVideoError      —— 视频不可用（已删除、私密等）
├── ContentTooShortError       —— 下载内容长度小于预期
```

---

## 三、stderr 日志格式约定

yt-dlp 的 stderr 输出遵循统一的带标签前缀格式：

### 3.1 日志级别前缀

| 前缀 | 级别 | 说明 |
|---|---|---|
| `ERROR:` | 错误 | 一般情况下会导致退出码非零 |
| `WARNING:` | 警告 | 不会影响退出码，但提示潜在问题 |
| `[debug]` | 调试 | 仅在 `-v` (/`--verbose`) 模式下输出 |

### 3.2 ERROR 典型消息

| stderr 典型日志 | 对应异常/场景 | 退出码 |
|---|---|---|
| `ERROR: [extractor] URL: HTTP Error 403: Forbidden` | `ExtractorError` / HTTP 403 | 1 |
| `ERROR: [extractor] URL: Unable to download webpage` | `ExtractorError` | 1 |
| `ERROR: [extractor] URL: Requested format is not available` | `ExtractorError` | 1 |
| `ERROR: [extractor] URL: Private video` | `UnavailableVideoError` | 1 |
| `ERROR: [extractor] URL: Video unavailable` | `UnavailableVideoError` | 1 |
| `ERROR: [extractor] URL: This video is age-restricted` | `ExtractorError` | 1 |
| `ERROR: [extractor] URL: Sign in to confirm your age` | `ExtractorError` | 1 |
| `ERROR: [extractor] URL: Geo-restricted` | `GeoRestrictedError` | 1 |
| `ERROR: [extractor] URL: This live event has ended` | `UnavailableVideoError` | 1 |
| `ERROR: [extractor] URL: Player request failed` | `ExtractorError` / `DownloadError` | 1 |
| `ERROR: [extractor] URL: Incomplete data received` | `ContentTooShortError` | 1 |
| `ERROR: unable to download video data: HTTP Error 403` | `HTTPError` / `DownloadError` | 1 |
| `ERROR: Unsupported URL: ...` | `UnsupportedError` | 1 |
| `ERROR: fixed file name already exists` | `SameFileError` | 1 |
| `ERROR: batch file xxx could not be read` | `OSError` | 1 |
| `ERROR: Interrupted by user` | `KeyboardInterrupt` | 1 |
| `ERROR: [youtube] URL: Sign in to confirm you're not a bot` | `ExtractorError` | 1 |
| `ERROR: [BiliBili] URL: Unable to download webpage: HTTP Error 412: Precondition Failed` | `ExtractorError` / `HTTPError` | 1 |
| `ERROR: [BilibiliSpaceVideo] ID: Request is blocked by server (412)` | `ExtractorError` | 1 |

### 3.3 WARNING 典型消息

| stderr 典型日志 | 说明 |
|---|---|
| `WARNING: [extractor] Falling back on generic information extractor` | 专用提取器不可用，降级至通用提取器 |
| `WARNING: [extractor] Failed to download m3u8 information` | 无法获取 m3u8 流信息，可能跳过该格式 |
| `WARNING: [extractor] unable to extract video data` | 无法提取视频数据 |
| `WARNING: Unable to extract uploader id` | 无法提取到某些元数据字段 |
| `WARNING: [extractor] You are using an extractor that is known to be broken` | 提取器已知存在问题 |
| `WARNING: [extractor] Some formats are not available` | 部分格式不可用 |
| `WARNING: Trying to extract metadata from a broken extractor` | 从已知损坏的提取器提取数据 |

---

## 四、HTTP 网络错误码映射

yt-dlp 基于 `requests` / `urllib` 库，以下为常见的网络层异常：

| 异常类 | 典型 stderr 输出 | 可能原因 |
|---|---|---|
| `HTTPError` (403) | `HTTP Error 403: Forbidden` | 被服务器拒绝访问（IP 封锁、需要 Cookie） |
| `HTTPError` (404) | `HTTP Error 404: Not Found` | 视频/资源不存在 |
| `HTTPError` (410) | `HTTP Error 410: Gone` | 视频已被删除 |
| `HTTPError` (412) | `HTTP Error 412: Precondition Failed` | (BiliBili 专用) 反爬虫策略封锁，需 Cookie 或浏览器 JS 验证；详见下文说明 |
| `HTTPError` (429) | `HTTP Error 429: Too Many Requests` | 请求频率过高被限流 |
| `HTTPError` (5xx) | `HTTP Error 5xx: Server Error` | 目标服务器故障 |
| `SSLError` | `SSL: CERTIFICATE_VERIFY_FAILED` | SSL 证书验证失败 |
| `RequestError` | `Unable to download webpage` | 通用网络请求失败 |
| `urllib.error.URLError` | `urlopen error [Errno ...]` | 网络不可达、DNS 解析失败 |

### 4.1 HTTP 412 Precondition Failed 详解（BiliBili 反爬场景）

**⚠️ 非标准用法**: 在 yt-dlp 的 BiliBili 提取器中，HTTP 412 并非 RFC 标准定义的"条件请求头不满足"，而是 **Bilibili 服务器主动返回的反爬虫封锁信号**。

| 项目 | 说明 |
|---|---|
| **典型 stderr** | `ERROR: [BiliBili] ID: Unable to download webpage: HTTP Error 412: Precondition Failed` |
| **异常路径** | `urllib.error.HTTPError` → `yt_dlp.networking.exceptions.HTTPError` → `ExtractorError` (退出码 1) |
| **常见触发原因** | ① 未提供 Cookie 或 Cookie 已过期<br>② 非中国大陆 / 数据中心 IP 地址触发风控<br>③ 短时间请求频率过高（速率限制）<br>④ Bilibili 要求客户端完成浏览器 JS 验证挑战 |
| **封锁时长** | 从数分钟到数小时不等，视 IP 和触发原因而定 |
| **已知特点** | 即使被封锁，通过直接 BV-ID 下载视频可能仍然可用；仅频道/UP主视频列表解析会被阻断 |

**解决建议**:

1. **提供 Cookie**: 在浏览器中登录 bilibili.com，然后使用 `--cookies-from-browser BROWSER` 或导出 Cookie 文件后使用 `--cookies FILE`
2. **等待后重试**: 412 封锁通常是临时的，等待一段时间后可自动恢复
3. **更新 yt-dlp**: 确保使用最新 nightly/master 版本，可能包含对抗 412 的修复
4. **使用直链 BV-ID**: 如果仅是列表解析被屏蔽，可尝试直接用视频 BV 号下载

> **参考**: GitHub Issues [#12013](https://github.com/yt-dlp/yt-dlp/issues/12013)、[#14830](https://github.com/yt-dlp/yt-dlp/issues/14830)

---

## 五、与 FFmpeg 的交互错误

yt-dlp 后处理阶段调用 FFmpeg 时，FFmpeg 的错误会经 `PostProcessingError` 传播：

| stderr 典型日志 | 说明 |
|---|---|
| `ERROR: Post-processing: ...` | 后处理阶段 FFmpeg 报错 |
| `ERROR: Post-processing: conversion failed` | 格式转换失败 |
| `ERROR: Post-processing: ffprobe and ffmpeg not found` | 系统缺少 FFmpeg |
| `ERROR: Post-processing: mkvmerge not found` | 缺少 mkvmerge 工具 |

---

## 六、重试机制

yt-dlp 支持内置重试，可通过命令行选项控制：

| 选项 | 默认值 | 控制内容 |
|---|---|---|
| `--retries` | 10 | 下载失败后的重试次数 |
| `--fragment-retries` | 10 | 分片下载失败后的重试次数 |
| `--extractor-retries` | 3 | 提取信息失败后的重试次数 |
| `--file-access-retries` | 3 | 文件访问失败后的重试次数 |
| `--retry-sleep` | — | 重试间隔的 sleep 函数（线性/指数退避） |

---

## 参考资料

- [yt-dlp GitHub: Issue #4262 — 官方退出码定义](https://github.com/yt-dlp/yt-dlp/issues/4262)
- [yt-dlp `__init__.py` — main() 退出处理](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/__init__.py)
- [yt-dlp `YoutubeDL.py` — 核心下载逻辑](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/YoutubeDL.py)
- [yt-dlp `utils/_utils.py` — 异常类定义](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/utils/_utils.py)
- [yt-dlp `options.py` — 命令行选项定义](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/options.py)
- [yt-dlp Issue #14830 — BiliBili HTTP 412 Precondition Failed](https://github.com/yt-dlp/yt-dlp/issues/14830)
- [yt-dlp Issue #12013 — BiliBili 412 反爬绕过方案](https://github.com/yt-dlp/yt-dlp/issues/12013)
