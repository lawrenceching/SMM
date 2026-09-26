import { describe, expect, it } from "vitest";
import {
  coreRouteKey,
  coreRoutes,
  isCoreRoute,
} from "./coreRouteTable.ts";

describe("coreRouteTable", () => {
  it("derives isCoreRoute from coreRoutes entries", () => {
    expect(coreRoutes.length).toBeGreaterThan(0);
    for (const route of coreRoutes) {
      expect(isCoreRoute(route.method, route.path)).toBe(true);
    }
  });

  it("rejects unknown method/path combinations", () => {
    expect(isCoreRoute("POST", "/api/executeCmd")).toBe(false);
    expect(isCoreRoute("GET", "/api/readFile")).toBe(false);
    expect(isCoreRoute("POST", "/index.html")).toBe(false);
  });

  it("matches method case-insensitively via coreRouteKey", () => {
    expect(coreRouteKey("get", "/api/hello")).toBe("GET /api/hello");
    expect(isCoreRoute("get", "/api/hello")).toBe(true);
  });

  it("has unique method+path keys", () => {
    const keys = coreRoutes.map((r) => coreRouteKey(r.method, r.path));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
