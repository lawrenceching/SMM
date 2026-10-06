# apps/server

SMM HTTP server library (Hono + Socket.IO + MCP). Consumed by `apps/cli` via the `smm web` command.

Dependency direction: `apps/cli -> apps/server -> apps/core`. This package must never import from `apps/cli`.
