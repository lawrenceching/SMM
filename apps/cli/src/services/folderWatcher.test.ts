import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FolderWatcher,
  getFolderWatcher,
  resetFolderWatcherForTests,
} from './folderWatcher';

describe('FolderWatcher.setWatchedFolder', () => {
  let dirA: string;
  let dirB: string;
  let watcher: FolderWatcher;

  beforeEach(() => {
    resetFolderWatcherForTests();
    dirA = mkdtempSync(join(tmpdir(), 'smm-watch-a-'));
    dirB = mkdtempSync(join(tmpdir(), 'smm-watch-b-'));
    watcher = getFolderWatcher(10);
  });

  afterEach(() => {
    resetFolderWatcherForTests();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('watches a single folder', () => {
    watcher.setWatchedFolder(dirA);
    expect(watcher.getWatchedFolders().length).toBe(1);
    expect(watcher.isWatching(dirA)).toBe(true);
  });

  it('switches from A to B (stops A, starts B)', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(dirB);
    expect(watcher.isWatching(dirA)).toBe(false);
    expect(watcher.isWatching(dirB)).toBe(true);
    expect(watcher.getWatchedFolders().length).toBe(1);
  });

  it('null clears all watches', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(null);
    expect(watcher.getWatchedFolders()).toEqual([]);
  });

  it('empty string clears all watches', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder('');
    expect(watcher.getWatchedFolders()).toEqual([]);
  });

  it('same path twice stays watching once (idempotent)', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(dirA);
    expect(watcher.getWatchedFolders().length).toBe(1);
    expect(watcher.isWatching(dirA)).toBe(true);
  });
});
