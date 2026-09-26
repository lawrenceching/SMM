import { afterEach, describe, expect, it } from "vitest";
import {
  resolveHttpBindAddress,
  resolveReverseProxyAdvertisedHost,
  resolveReverseProxyBindAddress,
  resolveWebUiBindAddress,
  resolveMcpBindAddress,
  resolveMcpAdvertisedHost,
} from "./bindAddresses.ts";

describe("bindAddresses", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("resolveHttpBindAddress defaults to 127.0.0.1", () => {
    delete process.env.HTTP_ADDRESS;
    delete process.env.WEBUI_ADDRESS;
    expect(resolveHttpBindAddress()).toBe("127.0.0.1");
  });

  it("resolveHttpBindAddress reads HTTP_ADDRESS", () => {
    delete process.env.WEBUI_ADDRESS;
    process.env.HTTP_ADDRESS = "0.0.0.0";
    expect(resolveHttpBindAddress()).toBe("0.0.0.0");
  });

  it("resolveHttpBindAddress prefers HTTP_ADDRESS over WEBUI_ADDRESS", () => {
    process.env.HTTP_ADDRESS = "0.0.0.0";
    process.env.WEBUI_ADDRESS = "127.0.0.1";
    expect(resolveHttpBindAddress()).toBe("0.0.0.0");
  });

  it("resolveHttpBindAddress falls back to WEBUI_ADDRESS", () => {
    delete process.env.HTTP_ADDRESS;
    process.env.WEBUI_ADDRESS = "0.0.0.0";
    expect(resolveHttpBindAddress()).toBe("0.0.0.0");
  });

  it("resolveWebUiBindAddress aliases resolveHttpBindAddress", () => {
    process.env.HTTP_ADDRESS = "10.0.0.1";
    expect(resolveWebUiBindAddress()).toBe("10.0.0.1");
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
