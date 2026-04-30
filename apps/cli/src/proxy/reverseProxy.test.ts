import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleProxyRequest,
  buildUpstreamUrl,
  validateUpstreamBaseURL,
  filterRequestHeaders,
  filterResponseHeaders,
  PORT_RANGE_START,
  PORT_RANGE_END,
} from './reverseProxy';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(responseBody, { status, headers });
}

function makeProxyRequest(path: string, upstreamBaseURL: string, options?: { method?: string; body?: string; extraHeaders?: Record<string, string> }) {
  const headers: Record<string, string> = {
    'X-SMM-Proxy-Upstream-BaseURL': upstreamBaseURL,
    ...options?.extraHeaders,
  };
  return new Request(`http://127.0.0.1:30001${path}`, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body ?? null,
  });
}

describe('buildUpstreamUrl', () => {
  it('joins base path with incoming path and query', () => {
    const result = buildUpstreamUrl('https://api.themoviedb.org/3', '/search/tv', '?query=test');
    expect(result).toBe('https://api.themoviedb.org/3/search/tv?query=test');
  });

  it('handles base URL without trailing slash', () => {
    const result = buildUpstreamUrl('https://api.themoviedb.org/3', '/tv/123', '');
    expect(result).toBe('https://api.themoviedb.org/3/tv/123');
  });

  it('handles base URL with trailing slash', () => {
    const result = buildUpstreamUrl('https://api.themoviedb.org/3/', '/tv/123', '');
    expect(result).toBe('https://api.themoviedb.org/3/tv/123');
  });

  it('handles paths without query string', () => {
    const result = buildUpstreamUrl('https://httpbin.io', '/get', '');
    expect(result).toBe('https://httpbin.io/get');
  });
});

describe('validateUpstreamBaseURL', () => {
  it('accepts allowlisted TMDB host', () => {
    const url = validateUpstreamBaseURL('https://api.themoviedb.org/3');
    expect(url.hostname).toBe('api.themoviedb.org');
  });

  it('accepts allowlisted TVDB host', () => {
    const url = validateUpstreamBaseURL('https://api4.thetvdb.com/v4');
    expect(url.hostname).toBe('api4.thetvdb.com');
  });

  it('accepts allowlisted httpbin host', () => {
    const url = validateUpstreamBaseURL('https://httpbin.io');
    expect(url.hostname).toBe('httpbin.io');
  });

  it('rejects malformed URL', () => {
    expect(() => validateUpstreamBaseURL('not-a-valid-url')).toThrow('Invalid upstream base URL');
  });

  it('rejects non-allowlisted host', () => {
    expect(() => validateUpstreamBaseURL('https://example.com/api')).toThrow('not allowed');
  });

  it('rejects non-http protocol', () => {
    expect(() => validateUpstreamBaseURL('ftp://api.themoviedb.org/3')).toThrow('http or https protocol');
  });
});

describe('filterRequestHeaders', () => {
  it('removes hop-by-hop request headers', () => {
    const request = new Request('http://localhost/test', {
      headers: {
        'X-SMM-Proxy-Upstream-BaseURL': 'https://api.themoviedb.org/3',
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=5',
        Upgrade: 'websocket',
        TE: 'trailers',
        Trailer: 'X-Custom',
        'Transfer-Encoding': 'chunked',
        'Proxy-Authorization': 'Basic abc',
        'Proxy-Authenticate': 'Basic',
        Accept: 'application/json',
      },
    });

    const upstreamUrl = new URL('https://api.themoviedb.org/3');
    const headers = filterRequestHeaders(request, upstreamUrl);

    expect(headers.get('Connection')).toBeNull();
    expect(headers.get('Keep-Alive')).toBeNull();
    expect(headers.get('Upgrade')).toBeNull();
    expect(headers.get('TE')).toBeNull();
    expect(headers.get('Trailer')).toBeNull();
    expect(headers.get('Transfer-Encoding')).toBeNull();
    expect(headers.get('Proxy-Authorization')).toBeNull();
    expect(headers.get('Proxy-Authenticate')).toBeNull();
    expect(headers.get('X-SMM-Proxy-Upstream-BaseURL')).toBeNull();
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('sets Host header from upstream URL', () => {
    const request = new Request('http://localhost/test');
    const upstreamUrl = new URL('https://api.themoviedb.org/3');
    const headers = filterRequestHeaders(request, upstreamUrl);
    expect(headers.get('Host')).toBe('api.themoviedb.org');
  });

  it('sets correct Host for tvdb upstream', () => {
    const request = new Request('http://localhost/test');
    const upstreamUrl = new URL('https://api4.thetvdb.com/v4');
    const headers = filterRequestHeaders(request, upstreamUrl);
    expect(headers.get('Host')).toBe('api4.thetvdb.com');
  });
});

describe('filterResponseHeaders', () => {
  it('filters hop-by-hop response headers', () => {
    const response = new Response('{}', {
      headers: {
        'Content-Type': 'application/json',
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=5',
        'Transfer-Encoding': 'chunked',
        'Content-Length': '100',
        'Content-Encoding': 'gzip',
        'Proxy-Authenticate': 'Basic',
        Upgrade: 'websocket',
        'X-Custom': 'value',
      },
    });

    const headers = filterResponseHeaders(response);

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Custom')).toBe('value');
    expect(headers.get('Connection')).toBeNull();
    expect(headers.get('Keep-Alive')).toBeNull();
    expect(headers.get('Transfer-Encoding')).toBeNull();
    expect(headers.get('Content-Length')).toBeNull();
    expect(headers.get('Content-Encoding')).toBeNull();
    expect(headers.get('Proxy-Authenticate')).toBeNull();
    expect(headers.get('Upgrade')).toBeNull();
  });
});

describe('handleProxyRequest', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('forwards a GET request and returns the upstream response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ result: 'ok' }));

    const request = makeProxyRequest('/search/tv?query=test', 'https://api.themoviedb.org/3');
    const response = await handleProxyRequest(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'ok' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.url).toBe('https://api.themoviedb.org/3/search/tv?query=test');
    expect(forwardedReq.method).toBe('GET');
  });

  it('rejects request with missing X-SMM-Proxy-Upstream-BaseURL', async () => {
    const request = new Request('http://127.0.0.1:30001/test');

    const response = await handleProxyRequest(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Missing X-SMM-Proxy-Upstream-BaseURL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects request with non-allowlisted upstream host', async () => {
    const request = makeProxyRequest('/test', 'https://example.com/api');

    const response = await handleProxyRequest(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('not allowed');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 502 when upstream fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = makeProxyRequest('/test', 'https://api.themoviedb.org/3');
    const response = await handleProxyRequest(request);

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toContain('Failed to proxy');
  });

  it('removes X-SMM-Proxy-Upstream-BaseURL from forwarded request', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = makeProxyRequest('/test', 'https://api.themoviedb.org/3');
    await handleProxyRequest(request);

    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.headers.get('X-SMM-Proxy-Upstream-BaseURL')).toBeNull();
  });

  it('sets Host header on forwarded request', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = makeProxyRequest('/test', 'https://api.themoviedb.org/3');
    await handleProxyRequest(request);

    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.headers.get('Host')).toBe('api.themoviedb.org');
  });

  it('joins upstream base path with request path', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = makeProxyRequest('/tv/123/season/1?language=en-US', 'https://api.themoviedb.org/3');
    await handleProxyRequest(request);

    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.url).toBe('https://api.themoviedb.org/3/tv/123/season/1?language=en-US');
  });

  it('accepts tvdb upstream', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

    const request = makeProxyRequest('/search', 'https://api4.thetvdb.com/v4');
    const response = await handleProxyRequest(request);

    expect(response.status).toBe(200);
    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.url).toBe('https://api4.thetvdb.com/v4/search');
  });

  it('accepts httpbin upstream', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = makeProxyRequest('/get', 'https://httpbin.io');
    const response = await handleProxyRequest(request);

    expect(response.status).toBe(200);
    const forwardedReq: Request = mockFetch.mock.calls[0][0];
    expect(forwardedReq.url).toBe('https://httpbin.io/get');
  });

  it('filters hop-by-hop response headers', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          'Transfer-Encoding': 'chunked',
        },
      }),
    );

    const request = makeProxyRequest('/test', 'https://api.themoviedb.org/3');
    const response = await handleProxyRequest(request);

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Connection')).toBeNull();
    expect(response.headers.get('Transfer-Encoding')).toBeNull();
  });
});

describe('CORS headers', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns CORS headers on successful response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = makeProxyRequest('/test', 'https://api.themoviedb.org/3');
    const response = await handleProxyRequest(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('*');
  });

  it('returns CORS headers on error response', async () => {
    const request = new Request('http://127.0.0.1:30001/test');

    const response = await handleProxyRequest(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('handles OPTIONS preflight', async () => {
    const request = new Request('http://127.0.0.1:30001/test', { method: 'OPTIONS' });

    const response = await handleProxyRequest(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('port range constants', () => {
  it('defines port range 30000-31000', () => {
    expect(PORT_RANGE_START).toBe(30000);
    expect(PORT_RANGE_END).toBe(31000);
  });
});
