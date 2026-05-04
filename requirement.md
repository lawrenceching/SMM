# /api/executeCmd 通用命令执行接口开发计划

1. 目标与概述
提供一个安全的、支持流式输出的服务端命令执行接口，允许前端通过 HTTP POST 请求执行白名单内的命令行工具（ffmpeg、ffprobe、yt-dlp），并以流式响应的方式实时返回标准输出、标准错误以及系统级消息（如退出码、异常信息）。核心要求：

严格白名单控制：仅允许预定义的三条命令，防止任意命令执行。

流式传输：利用分块传输编码（chunked）实时推送数据，前端可逐条解析。

可靠中断：当前端主动断开连接时，后端必须立即终止对应子进程，释放资源。

清晰的消息分类：响应中将 stdout、stderr 和系统消息区分开，便于前端处理。

2. 技术选型

子进程管理：child_process.spawn

流式编码：Transfer-Encoding: chunked + NDJSON（换行分隔 JSON），每个 JSON 对象包含 type 和 data 字段。
示例：{"type":"stdout","data":"frame=100 fps=30 ..."}\n

中断信号：c.req.raw.signal（基于 AbortController）

3. 接口定义
3.1 请求
方法：POST

路径：/api/executeCmd

Content-Type：application/json

请求体：

json
{
  "command": "ffmpeg" | "ffprobe" | "yt-dlp" | "videocaptioner",
  "args": ["-i", "input.mp4", ...]
}
校验规则：

command 必须为白名单值，否则返回 400 Bad Request。

args 必须是字符串数组，总长度不超过 100 项，单参数长度不超过 2000 字符。

args 中不允许出现换行、空字符等可能干扰解析的特殊字符（可通过正则白名单过滤）。

可选增加超时头 X-Timeout: 30000（毫秒），超时后自动终止。

3.2 响应
成功 (200)：立即开始流式传输，HTTP 头含 Transfer-Encoding: chunked，Content-Type: application/x-ndjson。

客户端错误 (4xx)：JSON 错误信息，如 {"error": "Invalid command"}。

流内的每条消息格式：

json
{"type":"stdout","data":"..."}
{"type":"stderr","data":"..."}
{"type":"system","data":{"event":"exit","code":0}}
{"type":"system","data":{"event":"error","message":"spawn ENOENT"}}
type: stdout | stderr | system

data: 对于 stdout/stderr 为字符串片段；对于 system 为结构化对象。

流的结束：发送最终系统消息后，主动关闭写入流，传输自然结束。

4. 详细设计
4.1 路由与验证层（Hono）
text
POST /api/executeCmd
  |
  |-> 1. 读取并解析 JSON body
  |-> 2. 校验 command ∈ ["ffmpeg", "ffprobe", "yt-dlp", "videocaptioner"]
  |-> 3. 校验 args 为 string[]，且满足长度、字符限制
  |-> 4. 若校验失败，立即返回 400 或 422
  |-> 5. 构建可中断流式响应
4.2 子进程创建与流式输出

命令的可执行文件通过 discovery 机制查找路径:
* apps\cli\src\route\ytdlp\Discover.ts
* apps\cli\src\route\ffmpeg\Discover.ts
* apps\cli\src\route\videocaptioner\Discover.ts

使用 spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })：

不开启 shell，避免注入风险。

设置 cwd 为受限工作目录。

可设置资源限制（如 timeout、maxBuffer 通过定时器自己实现）。

4.2.1 流构造逻辑
在 Hono 中使用 c.stream() 返回一个 ReadableStream。

在 ReadableStream 的 start(controller) 中：

创建子进程。

监听 child.stdout.on('data')：将数据编码为 NDJSON 行，通过 controller.enqueue(encoder.encode(jsonLine)) 推送。

监听 child.stderr.on('data')：同样编码推送。

监听 child.on('close', (code, signal) )：

推送系统消息 {"type":"system","data":{"event":"exit","code":code,"signal":signal}}

调用 controller.close() 结束流。

监听 child.on('error', err)：

推送系统错误消息 {"type":"system","data":{"event":"error","message":err.message}}

关闭流。

注册 c.req.raw.signal 的 abort 事件：当连接断开时，立即执行 child.kill('SIGTERM')（超时后强杀），并尝试关闭控制器。

重要：所有 enqueue 之后不立即关闭，确保客户端能消费完全部缓冲，或通过 signal 中断。

4.2.2 断连处理
利用 c.req.raw.signal.addEventListener('abort', ...)。Hono 在底层监听客户断开，一旦触发 abort：

若子进程存活则 child.kill()。

调用 controller.error() 或直接关闭流（取决于实现）。

避免内存泄露：移除所有监听器。

4.3 超时保护
客户端可通过 X-Timeout 头指定命令的最大执行时间（毫秒）。

服务端启动计时器，超时后发送系统消息 {"type":"system","data":{"event":"timeout"}}，杀死子进程，关闭流。

默认超时设定（如 5 分钟）防止僵尸进程。


4.5 错误处理矩阵
场景	处理方式
非法 command	400 立即返回
args 格式错误	400 立即返回
命令未安装 / 找不到	spawn error 事件，推送 system error，流关闭
命令执行中退出码非零	正常推送 stdout/stderr，最后推送 exit code != 0 的系统消息
客户端提前断开	在 abort 事件中 kill 子进程，不推送额外数据
超时	推送 timeout 系统消息，kill 子进程，关闭流
内部异常（如 enqueue 失败）	捕获异常，尝试 kill 子进程，清理资源
5. 工作流程时序图
text
Cli                 Hono Router              Child Process
 |                     |                           |
 |--POST /executeCmd-->|
 |                     |-- validate cmd & args     |
 |                     |-- spawn(command, args) --->|
 |                     |                           |-- stdout data
 |                     |<-- stdout chunk ----------|
 |<--NDJSON stdout-----|
 |                     |<-- stderr chunk ----------|
 |<--NDJSON stderr-----|
 |                     |                           |-- process close
 |                     |<-- close event -----------|
 |<--NDJSON exit code--|
 |                     | close stream              |
 |  (finish)           |                           |
如果客户端断开：

text
Cli                 Hono Router              Child Process
 |                     |                           |
 |--POST-------------->|                           |
 |--X (disconnect)     |                           |
 |                     | detect abort signal       |
 |                     |------kill(SIGTERM)------->|
 | (aborted)           | close controller          |
6. 测试计划
单元测试：

参数校验函数：合法/非法 command，args 格式，特殊字符拦截。

NDJSON 编码器：正确序列化各类消息。

集成测试（启动真实 Hono 应用）：

正常执行 ffmpeg -version，验证流式输出顺序及最终 exit code。

执行非法命令，期望 400。

执行不存在的 ffmpeg 路径（篡改 PATH），验证系统错误消息。

模拟长时间运行命令，发送 X-Timeout: 1000，验证超时终止。

前端中断测试：使用 curl 或代码发起请求并提前断开，通过进程列表确认子进程被杀死。

边界测试：超长 args，args 包含不可打印字符等。

压力测试：模拟并发请求，检查资源释放与内存泄漏。


9. 注意事项
ffmpeg / ffprobe 可能会输出大量数据，前端需要做好背压处理，但 Node.js 流控制的默认行为基本可靠；若长时间堵塞，可能需要实现自定义背压策略。

yt-dlp 下载进度可能通过 stderr 输出，需要确认客户端是否能正确区分。

若后续需要支持更多命令，可将白名单配置化，但必须经过严格的安全审查。

保证子进程在服务器重启时也能被正确杀死（使用 process.on('exit') 清理，或依赖操作系统回收）。