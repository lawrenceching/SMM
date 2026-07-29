import { afterEach, describe, expect, it } from "vitest";
import {
  resolveReverseProxyAdvertisedHost,
  resolveReverseProxyBindAddress,
  resolveWebUiBindAddress,
  resolveMcpBindAddress,
  resolveMcpAdvertisedHost,
} from "./bindAddresses.ts";

describe("bindAddresses", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("resolveWebUiBindAddress defaults to 127.0.0.1", () => {
    delete process.env.WEBUI_ADDRESS;
    expect(resolveWebUiBindAddress()).toBe("127.0.0.1");
  });

  it("resolveWebUiBindAddress reads WEBUI_ADDRESS", () => {
    process.env.WEBUI_ADDRESS = "0.0.0.0";
    expect(resolveWebUiBindAddress()).toBe("0.0.0.0");
  });

  it("resolveReverseProxyBindAddress defaults to 127.0.0.1", () => {
    delete process.env.REVERSE_PROXY_ADDRESS;
    expect(resolveReverseProxyBindAddress()).toBe("127.0.0.1");
  });

  it("resolveReverseProxyBindAddress reads REVERSE_PROXY_ADDRESS", () => {
    process.env.REVERSE_PROXY_ADDRESS = "0.0.0.0";
    expect(resolveReverseProxyBindAddress()).toBe("0.0.0.0");
  });

  it("resolveReverseProxyAdvertisedHost maps all-interfaces bind to loopback", () => {
    expect(resolveReverseProxyAdvertisedHost("0.0.0.0")).toBe("127.0.0.1");
    expect(resolveReverseProxyAdvertisedHost("::")).toBe("127.0.0.1");
    expect(resolveReverseProxyAdvertisedHost("127.0.0.1")).toBe("127.0.0.1");
  });

  it("resolveMcpBindAddress defaults to 127.0.0.1", () => {
    delete process.env.MCP_ADDRESS;
    expect(resolveMcpBindAddress()).toBe("127.0.0.1");
  });

  it("resolveMcpBindAddress reads MCP_ADDRESS", () => {
    process.env.MCP_ADDRESS = "0.0.0.0";
    expect(resolveMcpBindAddress("127.0.0.1")).toBe("0.0.0.0");
  });

  it("resolveMcpBindAddress uses fallback when MCP_ADDRESS unset", () => {
    delete process.env.MCP_ADDRESS;
    expect(resolveMcpBindAddress("192.168.1.1")).toBe("192.168.1.1");
  });

  it("resolveMcpAdvertisedHost maps all-interfaces bind to loopback", () => {
    expect(resolveMcpAdvertisedHost("0.0.0.0")).toBe("127.0.0.1");
  });
});
