# MCP 端到端测试

通过 MCP Inspector CLI 直接对 SMM CLI 的 MCP server 进行测试，不依赖浏览器和 WebdriverIO。

## 概述

传统 e2e 测试通过 wdio 打开浏览器、在 UI 上启动 MCP server，再用自定义的 `McpClient` 调用工具。本目录的测试改为：

1. 通过 `smm mcp start` 命令启动独立的 MCP server（每个测试文件一个子进程，使用隔离的临时目录和随机端口）
2. 通过 `@modelcontextprotocol/inspector` 的 CLI 模式（`--cli`）直接调用 MCP 工具
3. 断言工具的 `result.structuredContent` 返回

这样测试完全不依赖浏览器和 UI，运行更快、更稳定。

## 前置条件

- 已安装 Bun（`bun test`）
- 已安装根目录 devDependencies（`@modelcontextprotocol/inspector`）

```bash
pnpm install
```

## 运行测试

在项目根目录执行：

```bash
bun test test/mcp/
```

运行单个测试文件：

```bash
bun test test/mcp/readme.test.ts
```

## 测试列表

| 测试文件 | 覆盖的工具 |
|----------|-----------|
| `readme.test.ts` | `readme` |
| `how-to-rename-episode-video-files.test.ts` | `how-to-rename-episode-video-files` |
| `how-to-recognize-episode-video-files.test.ts` | `how-to-recognize-episode-video-files` |
| `get-app-context.test.ts` | `get-app-context` |
| `get-media-folders.test.ts` | `get-media-folders` |
| `is-folder-exist.test.ts` | `is-folder-exist` |
| `list-files.test.ts` | `list-files` |
| `get-media-metadata.test.ts` | `get-media-metadata` |
| `get-episode.test.ts` | `get-episode` |
| `get-episodes.test.ts` | `get-episodes` |
| `rename-folder.test.ts` | `rename-folder` |
| `scrape.test.ts` | `scrape`, `get-job` |
| `tmdb-tools.test.ts` | `tmdb-search`, `tmdb-get-movie`, `tmdb-get-tv-show` |
| `start-stop-mcp-server-in-cli.test.ts` | `smm mcp start` / stop (SIGINT on Unix) |

## 架构

```
test/mcp/
├── lib/
│   ├── mcpInspectorClient.ts   # 通过 bun $ 调用 MCP Inspector CLI，解析 structuredContent
│   ├── mcpServer.ts            # spawn `smm mcp start` 子进程，等待就绪，清理
│   ├── testSetup.ts            # 创建测试媒体目录、写 smm.json、写入元数据缓存
│   └── useMcpServer.ts         # 共享的 beforeAll/afterAll 钩子（启动/停止 server）
└── *.test.ts                   # 各工具测试
```

### 如何工作

1. `mcpServer.ts` 用 `bun apps/cli/index.ts mcp start --host 127.0.0.1 --port <随机端口>` 启动子进程，
   并设置隔离的 `USER_DATA_DIR` / `APP_DATA_DIR` / `LOG_DIR` 环境变量（指向临时目录），
   然后通过 `tools/list` 轮询直到 server 就绪。
2. `mcpInspectorClient.ts` 解析 `@modelcontextprotocol/inspector` 包的 launcher 路径，
   用 `node <launcher> --cli --server-url <url>/mcp --method tools/call --tool-name <name> --tool-args-json <json> --format json` 调用工具。
   （不用 `npx`，因为 Windows 上 `npx` 会破坏反斜杠路径和 JSON 参数。）
3. `testSetup.ts` 复用 `test/media` 和 `test/templates/mediaMetadatas/` 的夹具，
   按 `metadataCacheFilePath` 规则直接写入元数据缓存，模拟已识别的媒体文件夹。

## 注意事项

- TMDB 相关测试（`tmdb-tools.test.ts`、`scrape.test.ts`）依赖网络，需要 `TMDB_HOST` / `TMDB_API_KEY`
  环境变量（读取自 `.env.local`）。
- Bun 的 fetch 不支持 `socks5://` 代理；当 `TMDB_HTTP_PROXY` 为 socks5 时，测试回退为直连。
- 首次 TMDB 请求可能较慢（failover），`tmdb-tools.test.ts` 已内置 3 次重试。
