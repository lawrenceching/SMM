import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Hono } from 'hono';
import { handleSetWatchedFolder } from './SetWatchedFolder';
import { getFolderWatcher, resetFolderWatcherForTests } from '../services/folderWatcher';

describe('POST /api/setWatchedFolder', () => {
  let dirA: string;
  let dirB: string;
  let app: Hono;

  beforeEach(() => {
    resetFolderWatcherForTests();
    dirA = mkdtempSync(join(tmpdir(), 'smm-api-watch-a-'));
    dirB = mkdtempSync(join(tmpdir(), 'smm-api-watch-b-'));
    app = new Hono();
    handleSetWatchedFolder(app);
    getFolderWatcher(10);
  });

  afterEach(() => {
    resetFolderWatcherForTests();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('starts watching the requested folder', async () => {
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { watchedFolder: dirA } });
    expect(getFolderWatcher().isWatching(dirA)).toBe(true);
  });

  it('switches watched folder', async () => {
    await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirB }),
    });
    await expect(res.json()).resolves.toEqual({ data: { watchedFolder: dirB } });
    expect(getFolderWatcher().isWatching(dirA)).toBe(false);
    expect(getFolderWatcher().isWatching(dirB)).toBe(true);
  });

  it('null stops watching', async () => {
    await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: null }),
    });
    await expect(res.json()).resolves.toEqual({ data: { watchedFolder: null } });
    expect(getFolderWatcher().getWatchedFolders()).toEqual([]);
  });
});
