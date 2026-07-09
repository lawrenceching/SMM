# OpenResty Proxy

基于 OpenResty + Lua 的反向代理，通过 `X-Upstream-Base-Url` 请求头指定上游地址，提供白名单校验与双层限流保护。

## 快速开始

```bash
docker build -t openresty-proxy .
docker run -p 8080:80 -p 8081:81 \
  -e UPSTREAM_WHITELIST=https://api.example.com,https://api2.example.com \
  -e MAX_REQ_PER_SECOND=10 \
  -e MAX_REQ_PER_DAY=10000 \
  openresty-proxy
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `UPSTREAM_WHITELIST` | (空) | 逗号分隔的上游地址白名单，为空时拒绝所有请求 |
| `MAX_REQ_PER_SECOND` | `10` | 每 IP 每秒最大请求数 |
| `MAX_REQ_PER_DAY` | `10000` | 每 IP 每天最大请求数 |
| `AUTH_ENABLED` | `false` | 是否启用 Bearer 鉴权。设为 `true` 时，未带合法 token 的请求返回 401 |
| `AUTH_METHOD` | (空) | 鉴权方法。可选值：`date-token`（UTC `yyyyMMdd`，±1 天窗口） |
| `CORS_ENABLED` | `false` | 是否注入 CORS 响应头。设为 `true` 时，所有响应携带 `Access-Control-Allow-Origin: *` 等头；`OPTIONS` 预检请求由代理以 `204` 直接响应，不再转发到上游 |

## 请求方式

客户端在请求头中传入 `X-Upstream-Base-Url` 指定上游地址，代理会将请求路径和参数原样转发：

```bash
curl -H "X-Upstream-Base-Url: https://api.example.com" http://proxy:8080/v1/users
```

上述请求会被代理到 `https://api.example.com/v1/users`。

## Bearer 鉴权

当 `AUTH_ENABLED=true` 时，所有非 `/health` 请求必须携带 `X-Proxy-Authorization` 头，token 为 UTC 当天日期（`yyyyMMdd`），允许前天、今天、明天：

```bash
TODAY=$(date -u +%Y%m%d)
curl -H "X-Proxy-Authorization: Bearer $TODAY" \
     -H "X-Upstream-Base-Url: https://api.example.com" \
     http://proxy:8080/v1/users
```

为什么是 `X-Proxy-Authorization` 而不是 `Authorization`：很多上游服务（TMDB、TVDB 等）自身也用 `Authorization` 鉴权，如果代理也读 `Authorization`，客户端同一时刻只能给一头赋值，两边会互相覆盖。`X-Proxy-Authorization` 是代理专用头，**不会被透传到上游**，因此可以与上游的 `Authorization` 共存。

方法由 `AUTH_METHOD` 指定。当前仅支持 `date-token`；`AUTH_METHOD` 缺失或为未知值时，鉴权失败统一返回 401。

## CORS

当 `CORS_ENABLED=true` 时，代理会向所有响应注入 CORS 头（`Access-Control-Allow-Origin: *` 等），浏览器跨源请求即可成功。

预检请求（`OPTIONS`）由代理直接以 `204 No Content` 响应，**不**经过 auth / 白名单 / 限流，也不消耗限流配额。

实际请求（非 `OPTIONS`）仍会经过 auth / 白名单 / 限流，但响应（成功或 401/403/429）都会携带 CORS 头，浏览器可以读取错误体。

注意：`Access-Control-Allow-Origin: *` 不允许携带 cookie 等凭证（这是浏览器侧的硬性规则，不是服务器行为）。如果需要凭证 CORS，请改用来源白名单（不在本文档范围内）。

## 发布流程

版本管理使用 [changesets](https://github.com/changesets/changesets)（`.changeset/` 位于仓库根目录，工作区级配置）。

| 步骤 | 命令（在 `packages/openresty-proxy/` 目录执行） | 作用 |
|---|---|---|
| 1 | `pnpm changeset` | 添加一条 changeset 描述本次变更。选择 semver（`patch` / `minor` / `major`）。 |
| 2 | `pnpm changeset:version` | 应用待发布的 changesets：更新 `package.json` 中的 `version`，生成 `CHANGELOG.md`。 |
| 3 | `pnpm build` | 构建 Docker 镜像，标签为刚 bump 的版本号 + `:latest`。 |
| 4 | `pnpm docker:push` | 推送两个标签到镜像仓库。 |

注意：脚本名是 `changeset:version`（带冒号），不是 `version` —— 因为 pnpm 内置了 `pnpm version` 命令（等价于 `npm version`），如果脚本叫 `version` 会被内置命令遮蔽，必须用 `pnpm run version` 才能跑脚本。改名为 `changeset:version` 之后 `pnpm changeset:version` 直接生效。

也可以从仓库根目录运行 `pnpm --filter @smm/openresty-proxy <script>` 达到同样效果。

`pnpm build` 和 `pnpm docker:push` 实际调用 `scripts/build.sh` 和 `scripts/push.sh`，镜像标签直接读取自 `package.json`，因此与版本始终保持一致。

## 响应

### 成功

请求正常转发并返回上游响应。

### 错误码

| 状态码 | 含义 |
|--------|------|
| `400` | 缺少 `X-Upstream-Base-Url` 请求头 |
| `401` | 鉴权失败（缺 token、token 过期、策略未配置或未知） |
| `403` | 上游地址不在白名单中 |
| `429` | 触发限流（每秒或每日上限） |

### 限流响应头

成功请求会携带以下响应头：

| 响应头 | 说明 |
|--------|------|
| `X-RateLimit-Limit-Second` | 每秒上限 |
| `X-RateLimit-Limit-Day` | 每日上限 |
| `X-RateLimit-Remaining-Day` | 当日剩余配额 |

## 健康检查

限流和白名单不会影响健康检查端点：

```bash
curl http://proxy:8081/health
# {"status":"ok"}
```
