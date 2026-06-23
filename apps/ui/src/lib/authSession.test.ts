import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getAuthLoginRequired,
  notifyUnauthorizedApiResponse,
  setAuthLoginRequired,
  with401Suppressed,
} from './authSession';

describe('authSession', () => {
  beforeEach(() => {
    setAuthLoginRequired(false);
  });

  it('sets login required on 401 API responses', () => {
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
});
