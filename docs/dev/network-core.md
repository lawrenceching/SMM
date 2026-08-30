# The network ability in core module

Support proxy procotol: http, https and socks5.

| Platform | Implementation |
|--|--|
| cli | apps/cli/src/core/NodejsNetworkPort.ts |
| ohos | apps/oho/src/core/OhosNetworkPort.ts |
| browser | apps/ui/src/core/BrowserNetworkPort.ts |

## BrowserNetworkPort

在 `apps/ui/src/core/BrowserNetworkPort` 实现 `NetworkPort`。

浏览器无法直连任意上游 / 出站代理，因此通过 CLI RPC：

1. `BrowserNetworkPort.fetch` → `POST /api/core/fetch`（`apiFetch`，带 auth）
2. CLI `handleCoreFetch` 用 `NodejsNetworkPort` 发起真实请求（含 `proxy`）
3. 响应以 `{ data: { ok, status, statusText, headers, bodyBase64 }, error? }` 返回；Port 再还原为 `HttpResponse`

`AbortSignal` 穿透：Browser `signal` → `POST /api/core/fetch`（断开连接）→ `c.req.raw.signal` → `NodejsNetworkPort.fetch({ signal })` → 上游 `fetch` / agent `req.destroy()`。

请求体：`{ url, method?, headers?, body?, proxy? }`。