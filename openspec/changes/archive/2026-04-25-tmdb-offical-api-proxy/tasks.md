## 1. Setup `apps/cli` Project

- [x] 1.1 Create `apps/cli` directory with `package.json`, `tsconfig.json` following existing app conventions (e.g., `apps/images`, `apps/upload`)
- [x] 1.2 Add `@types/bun` as devDependency, add `start` and `dev` scripts

## 2. Implement TMDB API Proxy Server

- [x] 2.1 Create `apps/cli/index.ts` with `Bun.serve()` HTTP server
- [x] 2.2 Implement `X-TMDB-Host` header routing logic: when set, proxy to specified host; when unset, proxy to `https://tmdb-mcp-server.imlc.me` with `/api/tmdb` path prefix
- [x] 2.3 Implement `X-TMDB-API-Key` header forwarding: convert to `Authorization: Bearer <value>` for upstream requests
- [x] 2.4 Preserve request method, path, query string, and body when proxying to upstream

## 3. Verify

- [ ] 3.1 Start the proxy server and test with curl: verify official API routing, SMM proxy routing, and API key forwarding
