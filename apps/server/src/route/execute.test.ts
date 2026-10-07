import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeRoute } from './execute';
import { readJson } from '../test/readJson';

vi.mock('../../tasks/GetSelectedMediaMetadataTask', () => ({
  executeGetSelectedMediaMetadataTask: vi.fn(async () => ({
    metadata: { id: 'movie-1' },
  })),
}));

import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';

function post(body: unknown | string) {
  return executeRoute.request('/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('/api/execute — orchestration route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes name="GetSelectedMediaMetadata" to its task handler', async () => {
    const res = await post({ name: 'GetSelectedMediaMetadata' });
    expect(res.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body).toEqual({ metadata: { id: 'movie-1' } });
  });

  it('returns 501 for unknown task names', async () => {
    const res = await post({ name: 'system' });
    expect(res.status).toBe(501);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toContain('"system" is not yet implemented');
  });

  it('returns 400 Zod error when name="hello" is sent (removed from enum)', async () => {
    const res = await post({ name: 'hello' });
    expect(res.status).toBe(400);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toBe('Validation failed');
    expect((body.details as Array<{ path: string; message: string }>)[0]!.path).toBe('name');
    expect((body.details as Array<{ path: string; message: string }>)[0]!.message).toContain('"system", "GetSelectedMediaMetadata"');
  });

  it('returns 400 Zod error when name is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const res = await post('not-json');
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Malformed JSON in request body');
  });

  it('maps task handler errors to 400 with parse-error body', async () => {
    vi.mocked(executeGetSelectedMediaMetadataTask).mockRejectedValueOnce(new Error('socket down'));
    const res = await post({ name: 'GetSelectedMediaMetadata' });
    expect(res.status).toBe(400);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toBe('Invalid JSON body or parsing error');
    expect(body.details).toBe('socket down');
  });

  it('does not register /api/hello (served by core-routes)', async () => {
    const res = await executeRoute.request('/api/hello', { method: 'GET' });
    expect(res.status).toBe(404);
  });
});
