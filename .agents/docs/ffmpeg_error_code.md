# FFmpeg 错误码参考文档

> 基于 FFmpeg master 源码 (`libavutil/error.h`, `libavutil/error.c`, `fftools/ffmpeg.c`) 整理
> 更新日期: 2026-06-02

---

## 一、FFmpeg 特有 AVERROR 常量

### 1.1 组件未找到

| stderr 典型日志 | AVERROR 常量 | 宏定义 |
|---|---|---|
| `Unknown encoder 'xxx'` | `AVERROR_ENCODER_NOT_FOUND` | `FFERRTAG(0xF8,'E','N','C')` |
| `Unknown decoder 'xxx'` | `AVERROR_DECODER_NOT_FOUND` | `FFERRTAG(0xF8,'D','E','C')` |
| `Unable to find a suitable output format for 'xxx'` | `AVERROR_MUXER_NOT_FOUND` | `FFERRTAG(0xF8,'M','U','X')` |
| `Unable to find a suitable input format for 'xxx'` | `AVERROR_DEMUXER_NOT_FOUND` | `FFERRTAG(0xF8,'D','E','M')` |
| `Filter 'xxx' not found` | `AVERROR_FILTER_NOT_FOUND` | `FFERRTAG(0xF8,'F','I','L')` |
| `Protocol 'xxx' not found` | `AVERROR_PROTOCOL_NOT_FOUND` | `FFERRTAG(0xF8,'P','R','O')` |
| `Bitstream filter 'xxx' not found` | `AVERROR_BSF_NOT_FOUND` | `FFERRTAG(0xF8,'B','S','F')` |
| `Stream not found` | `AVERROR_STREAM_NOT_FOUND` | `FFERRTAG(0xF8,'S','T','R')` |
| `Option not found` | `AVERROR_OPTION_NOT_FOUND` | `FFERRTAG(0xF8,'O','P','T')` |

### 1.2 数据与缓冲

| stderr 典型日志 | AVERROR 常量 | 宏定义 |
|---|---|---|
| `Invalid data found when processing input` | `AVERROR_INVALIDDATA` | `FFERRTAG('I','N','D','A')` |
| `End of file` | `AVERROR_EOF` | `FFERRTAG('E','O','F',' ')` |
| `Buffer too small` | `AVERROR_BUFFER_TOO_SMALL` | `FFERRTAG('B','U','F','S')` |

### 1.3 内部与运行时

| stderr 典型日志 | AVERROR 常量 | 宏定义 |
|---|---|---|
| `Internal bug, should not have happened` | `AVERROR_BUG` | `FFERRTAG('B','U','G','!')` |
| `Internal bug, should not have happened` | `AVERROR_BUG2` | `FFERRTAG('B','U','G',' ')` |
| `Not yet implemented in FFmpeg, patches welcome` | `AVERROR_PATCHWELCOME` | `FFERRTAG('P','A','W','E')` |
| `Immediate exit requested` | `AVERROR_EXIT` | `FFERRTAG('E','X','I','T')` |
| `Generic error in an external library` | `AVERROR_EXTERNAL` | `FFERRTAG('E','X','T',' ')` |
| `Unknown error occurred` | `AVERROR_UNKNOWN` | `FFERRTAG('U','N','K','N')` |
| `Experimental feature` | `AVERROR_EXPERIMENTAL` | `-0x2bb2afa8` |

### 1.4 流状态变更

| AVERROR 常量 | 宏定义 |
|---|---|
| `AVERROR_INPUT_CHANGED` | `-0x636e6701` |
| `AVERROR_OUTPUT_CHANGED` | `-0x636e6702` |
| `AVERROR_INPUT_AND_OUTPUT_CHANGED` | `(AVERROR_INPUT_CHANGED \| AVERROR_OUTPUT_CHANGED)` |

### 1.5 HTTP 网络错误

| AVERROR 常量 | 宏定义 | 含义 |
|---|---|---|
| `AVERROR_HTTP_BAD_REQUEST` | `FFERRTAG(0xF8,'4','0','0')` | Server returned 400 Bad Request |
| `AVERROR_HTTP_UNAUTHORIZED` | `FFERRTAG(0xF8,'4','0','1')` | Server returned 401 Unauthorized |
| `AVERROR_HTTP_FORBIDDEN` | `FFERRTAG(0xF8,'4','0','3')` | Server returned 403 Forbidden |
| `AVERROR_HTTP_NOT_FOUND` | `FFERRTAG(0xF8,'4','0','4')` | Server returned 404 Not Found |
| `AVERROR_HTTP_TOO_MANY_REQUESTS` | `FFERRTAG(0xF8,'4','2','9')` | Server returned 429 Too Many Requests |
| `AVERROR_HTTP_OTHER_4XX` | `FFERRTAG(0xF8,'4','X','X')` | Server returned 4XX Client Error |
| `AVERROR_HTTP_SERVER_ERROR` | `FFERRTAG(0xF8,'5','X','X')` | Server returned 5XX Server Error |

---

## 二、系统错误码 (POSIX errno) 映射

FFmpeg 使用 `AVERROR(e)` 宏将 POSIX 错误码转为负值返回。

| stderr 典型日志 | errno | 数值 | 表达式 |
|---|---|---|---|
| `No such file or directory` | `ENOENT` | 2 | `AVERROR(ENOENT)` |
| `Permission denied` | `EACCES` | 13 | `AVERROR(EACCES)` |
| `Cannot allocate memory` | `ENOMEM` | 12 | `AVERROR(ENOMEM)` |
| `Invalid argument` | `EINVAL` | 22 | `AVERROR(EINVAL)` |
| `No space left on device` | `ENOSPC` | 28 | `AVERROR(ENOSPC)` |
| `Resource temporarily unavailable` | `EAGAIN` | 11 | `AVERROR(EAGAIN)` |
| `Bad file descriptor` | `EBADF` | 9 | `AVERROR(EBADF)` |
| `File exists` | `EEXIST` | 17 | `AVERROR(EEXIST)` |
| `File too large` | `EFBIG` | 27 | `AVERROR(EFBIG)` |
| `I/O error` | `EIO` | 5 | `AVERROR(EIO)` |
| `Is a directory` | `EISDIR` | 21 | `AVERROR(EISDIR)` |
| `Too many open files` | `EMFILE` | 24 | `AVERROR(EMFILE)` |
| `Illegal byte sequence` | `EILSEQ` | 42 | `AVERROR(EILSEQ)` |
| `Function not implemented` | `ENOSYS` | 38 | `AVERROR(ENOSYS)` |
| `Broken pipe` | `EPIPE` | 32 | `AVERROR(EPIPE)` |
| `Operation not permitted` | `EPERM` | 1 | `AVERROR(EPERM)` |

---

## 三、FFmpeg CLI 退出码

| 退出码 | 含义 | 说明 |
|---|---|---|
| **0** | 成功 | 正常完成转换；`--help`/`--version` 等选项也会返回 0 |
| **1** | 通用错误 | 绝大多数错误：文件不存在、编码器找不到、参数错误等 |
| **69** | 错误率超限 | 错误帧比率超过 `-max_error_rate` 阈值 |
| **123** | 强制退出 | 收到超过 3 次系统信号 (SIGINT/SIGTERM) 后的硬退出 |

> **注意**: 源码中不存在 exit code 2 的定义，参数解析错误统一返回 1。  
> 部分旧版本可能在某些非致命场景下返回 0 但 stderr 有错误输出，建议同时检测退出码和解析 stderr。

---

## 四、av_strerror() 描述与 CLI stderr 对照

AVERROR 常量通过 `av_strerror()` / `av_err2str()` 获取的固定描述文本，与 CLI 输出的 stderr 消息有所不同：

| AVERROR 常量 | av_strerror() 输出 | CLI stderr 典型输出 |
|---|---|---|
| `AVERROR_ENCODER_NOT_FOUND` | `Encoder not found` | `[aost#0:0 @ 0x...] Unknown encoder 'libmp3lame'` |
| `AVERROR_DECODER_NOT_FOUND` | `Decoder not found` | `Unknown decoder 'xxx'` |
| `AVERROR_MUXER_NOT_FOUND` | `Muxer not found` | `Unable to find a suitable output format for 'xxx'` |
| `AVERROR_DEMUXER_NOT_FOUND` | `Demuxer not found` | `Unable to find a suitable input format for 'xxx'` |
| `AVERROR_FILTER_NOT_FOUND` | `Filter not found` | `Filter 'xxx' not found` |
| `AVERROR_PROTOCOL_NOT_FOUND` | `Protocol not found` | `Protocol 'xxx' not found` |
| `AVERROR_INVALIDDATA` | `Invalid data found when processing input` | `Invalid data found when processing input` |
| `AVERROR_EOF` | `End of file` | `End of file` |
| `AVERROR_BUG` | `Internal bug, should not have happened` | `Internal bug, should not have happened` |
| `AVERROR_PATCHWELCOME` | `Not yet implemented in FFmpeg, patches welcome` | `Not yet implemented in FFmpeg, patches welcome` |

---

## 附录: av_strerror() 完整错误消息列表

源自 `libavutil/error.c` 的 `AVERROR_LIST`：

```
"Bitstream filter not found"
"Internal bug, should not have happened"
"Buffer too small"
"Decoder not found"
"Demuxer not found"
"Encoder not found"
"End of file"
"Immediate exit requested"
"Generic error in an external library"
"Filter not found"
"Input changed"
"Invalid data found when processing input"
"Muxer not found"
"Option not found"
"Output changed"
"Not yet implemented in FFmpeg, patches welcome"
"Protocol not found"
"Stream not found"
"Unknown error occurred"
"Experimental feature"
"Input and output changed"
"Server returned 400 Bad Request"
"Server returned 401 Unauthorized (authorization failed)"
"Server returned 403 Forbidden (access denied)"
"Server returned 404 Not Found"
"Server returned 429 Too Many Requests"
"Server returned 4XX Client Error, but not one of 40{0,1,3,4}"
"Server returned 5XX Server Error reply"
```

---

## 参考资料

- [FFmpeg libavutil/error.h](https://github.com/FFmpeg/FFmpeg/blob/master/libavutil/error.h)
- [FFmpeg libavutil/error.c](https://github.com/FFmpeg/FFmpeg/blob/master/libavutil/error.c)
- [FFmpeg fftools/ffmpeg.c](https://github.com/FFmpeg/FFmpeg/blob/master/fftools/ffmpeg.c)
- [FFmpeg Doxygen: Error Codes](https://ffmpeg.org/doxygen/trunk/group__lavu__error.html)
