import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getAuthLoginRequired,
  notifyUnauthorizedApiResponse,
  setAuthLoginRequired,
  shouldBypassAuthLoginGate,
  with401Suppressed,
} from './authSession';

describe('authSession', () => {
  beforeEach(() => {
    setAuthLoginRequired(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets login required on 401 API responses', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 (Windows NT 10.0)' });
    notifyUnauthorizedApiResponse(new Response(null, { status: 401 }), '/api/hello');
    expect(getAuthLoginRequired()).toBe(true);
  });

  it('ignores non-401 responses', () => {
    notifyUnauthorizedApiResponse(new Response(null, { status: 200 }), '/api/hello');
    expect(getAuthLoginRequired()).toBe(false);
  });

  it('suppresses 401 handling while verifying login', () => {
    void with401Suppressed(async () => {
      notifyUnauthorizedApiResponse(new Response(null, { status: 401 }), '/api/hello');
      expect(getAuthLoginRequired()).toBe(false);
    });
  });

  it('does not require login on 401 in Electron', () => {
    vi.stubGlobal('window', { electron: {} });
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 (Windows NT 10.0)' });
    notifyUnauthorizedApiResponse(new Response(null, { status: 401 }), '/api/hello');
    expect(getAuthLoginRequired()).toBe(false);
  });

  it('does not require login on 401 on HarmonyOS', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 OHOS 5.0' });
    notifyUnauthorizedApiResponse(new Response(null, { status: 401 }), '/api/hello');
    expect(getAuthLoginRequired()).toBe(false);
  });
});

describe('shouldBypassAuthLoginGate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false in browser', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(shouldBypassAuthLoginGate()).toBe(false);
  });

  it('returns true in Electron', () => {
    vi.stubGlobal('window', { electron: {} });
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(shouldBypassAuthLoginGate()).toBe(true);
  });

  it('returns true on HarmonyOS', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { appVersion: 'Mozilla/5.0 OpenHarmony' });
    expect(shouldBypassAuthLoginGate()).toBe(true);
  });
});
