# Path-mounted reverse proxy Implementation Plan

> **For agentic workers:** Implement task-by-task. Verify with unit tests then `pnpm e2e:tv` / `pnpm e2e:movie`.

**Goal:** Mount the SMM L7 reverse proxy on `/proxy/*` of the main HTTP server instead of a separate port.

**Architecture:** Add `stripPathPrefix` to `handleProxyRequest`; CLI/ohos mount the handler on `/proxy`; hello advertises `http://host:port/proxy`; Vite proxies `/proxy` in dev.

**Tech Stack:** Hono (CLI), Node `http` (ohos), `@smm/core-routes` reverse proxy.

## Global Constraints

- Mount path must be exactly `/proxy` (user requirement)
- Keep `X-SMM-Proxy-Upstream-BaseURL` semantics
- Standalone `createReverseProxyManager` remains for unit tests (no path prefix)
- Post-change: build/typecheck; verify with `pnpm e2e:tv` and `pnpm e2e:movie`

---

### Task 1: core-routes path strip + constant

**Files:**
- Modify: `packages/core-routes/src/reverseProxy.ts`
- Modify: `packages/core-routes/src/index.ts`
- Modify: `packages/core-routes/src/reverseProxy.test.ts`
- Modify: `packages/core-routes/src/reverseProxyNode.ts` (docs / optional attached helper)

- [ ] Export `REVERSE_PROXY_MOUNT_PATH = "/proxy"`
- [ ] Add `stripPathPrefix?: string` to `ReverseProxyConfig`
- [ ] Strip prefix in `handleProxyRequest` before `buildUpstreamUrl`
- [ ] Unit test: request `/proxy/foo` with strip `/proxy` forwards `/foo`
- [ ] Add `buildReverseProxyPublicUrl(origin: string): string`

### Task 2: CLI mount on main server

**Files:**
- Modify: `apps/cli/server.ts`
- Modify: `apps/ui/vite.config.ts`

- [ ] Register Hono `all('/proxy')` + `all('/proxy/*')` calling `handleProxyRequest` with strip
- [ ] Do not `proxyManager.start()` (no second listen)
- [ ] hello `reverseProxyUrl` = `http://<advertised>:<port>/proxy`
- [ ] Vite `server.proxy['/proxy']` → CLI

### Task 3: ohos mount

**Files:**
- Modify: `apps/ohos/src/http/server.ts`
- Modify: `apps/ohos/src/http/hello-config.ts` (if needed)

- [ ] Stop separate reverse proxy listen
- [ ] Route `/proxy` through `createReverseProxyRequestHandler` with strip
- [ ] hello `reverseProxyUrl` = `${MAIN_HTTP_ORIGIN}/proxy`

### Task 4: Verify

- [ ] `pnpm test:core-routes` (or focused reverseProxy tests)
- [ ] `pnpm e2e:tv`
- [ ] `pnpm e2e:movie`
