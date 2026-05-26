import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandLogCleaner } from './CommandLogCleaner';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises');

  const mockReaddir = vi.fn<() => Promise<string[]>>();
  const mockStat = vi.fn<() => Promise<{ isDirectory: () => boolean; mtime: Date }>>();
  const mockRm = vi.fn<() => Promise<void>>();

  return {
    ...actual,
    readdir: mockReaddir,
    stat: mockStat,
    rm: mockRm,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeDir(mtime: Date) {
  return { isDirectory: () => true, mtime };
}

function fakeFile() {
  return { isDirectory: () => false, mtime: new Date() };
}

async function mockModules() {
  const mod = await import('node:fs/promises');
  return {
    mockReaddir: mod.readdir as unknown as ReturnType<typeof vi.fn>,
    mockStat: mod.stat as unknown as ReturnType<typeof vi.fn>,
    mockRm: mod.rm as unknown as ReturnType<typeof vi.fn>,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandLogCleaner', () => {
  const logDir = '/tmp/smm/logs';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Edge case: commands/ dir does not exist
  // ----------------------------------------------------------------
  it('should return { removed: 0, remaining: 0 } when commands dir does not exist', async () => {
    const { mockReaddir } = await mockModules();
    mockReaddir.mockRejectedValue({ code: 'ENOENT' });

    const cleaner = new CommandLogCleaner({ logDir });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 0 });
    expect(mockReaddir).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // Edge case: readdir fails with unexpected error
  // ----------------------------------------------------------------
  it('should return safely when readdir fails unexpectedly', async () => {
    const { mockReaddir } = await mockModules();
    mockReaddir.mockRejectedValue(new Error('permission denied'));

    const cleaner = new CommandLogCleaner({ logDir });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 0 });
  });

  // ----------------------------------------------------------------
  // Edge case: empty commands dir
  // ----------------------------------------------------------------
  it('should return { removed: 0, remaining: 0 } when commands dir is empty', async () => {
    const { mockReaddir } = await mockModules();
    mockReaddir.mockResolvedValue([]);

    const cleaner = new CommandLogCleaner({ logDir });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 0 });
  });

  // ----------------------------------------------------------------
  // Normal case: ≤ maxLogDirs → no removal
  // ----------------------------------------------------------------
  it('should not remove anything when count ≤ maxLogDirs', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = new Date();

    // 3 directories, maxLogDirs = 5
    mockReaddir.mockResolvedValue(['dir-a', 'dir-b', 'dir-c']);
    mockStat.mockResolvedValue(fakeDir(now));

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 5 });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 3 });
    expect(mockRm).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Normal case: count = maxLogDirs → no removal
  // ----------------------------------------------------------------
  it('should not remove anything when count equals maxLogDirs', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = new Date();

    mockReaddir.mockResolvedValue(['d1', 'd2', 'd3']);
    mockStat.mockResolvedValue(fakeDir(now));

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 3 });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 3 });
    expect(mockRm).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Normal case: count > maxLogDirs → removes oldest
  // ----------------------------------------------------------------
  it('should remove the oldest directories when count exceeds maxLogDirs', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = Date.now();

    // 5 directories, maxLogDirs = 3 → should remove 2 oldest
    const oldest = new Date(now - 100_000);
    const secondOldest = new Date(now - 80_000);
    const middle = new Date(now - 50_000);
    const secondNewest = new Date(now - 20_000);
    const newest = new Date(now);

    mockReaddir.mockResolvedValue(['dir-1', 'dir-2', 'dir-3', 'dir-4', 'dir-5']);
    // mtime: oldest first → dir-4 (oldest), dir-1, dir-3, dir-5, dir-2 (newest)
    mockStat
      .mockResolvedValueOnce(fakeDir(secondOldest))  // dir-1
      .mockResolvedValueOnce(fakeDir(newest))          // dir-2
      .mockResolvedValueOnce(fakeDir(middle))           // dir-3
      .mockResolvedValueOnce(fakeDir(oldest))           // dir-4 → oldest
      .mockResolvedValueOnce(fakeDir(secondNewest));    // dir-5

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 3 });
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 2, remaining: 3 });

    // Should have deleted dir-4 (oldest) and dir-1 (second oldest)
    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining('dir-4'),
      { recursive: true, force: true },
    );
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining('dir-1'),
      { recursive: true, force: true },
    );
  });

  // ----------------------------------------------------------------
  // Tolerance: skip files, only count directories
  // ----------------------------------------------------------------
  it('should skip non-directory entries when counting', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();

    // 2 real dirs + 1 file
    mockReaddir.mockResolvedValue(['dir-a', 'some-file.txt', 'dir-b']);
    mockStat
      .mockResolvedValueOnce(fakeDir(new Date()))      // dir-a
      .mockResolvedValueOnce(fakeFile())                // some-file.txt → skip
      .mockResolvedValueOnce(fakeDir(new Date()));      // dir-b

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 3 });
    const result = await cleaner.clean();

    // count = 2 ≤ 3, no removal
    expect(result).toEqual({ removed: 0, remaining: 2 });
    expect(mockRm).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Tolerance: stat failure → skip that entry
  // ----------------------------------------------------------------
  it('should skip entries that fail to stat', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = new Date();

    mockReaddir.mockResolvedValue(['dir-a', 'dir-b', 'dir-c', 'dir-d', 'dir-e']);
    mockStat
      .mockResolvedValueOnce(fakeDir(now))          // dir-a
      .mockRejectedValueOnce(new Error('EACCES'))  // dir-b → skip
      .mockResolvedValueOnce(fakeDir(now))          // dir-c
      .mockResolvedValueOnce(fakeDir(now))          // dir-d
      .mockResolvedValueOnce(fakeDir(now));         // dir-e

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 5 });
    const result = await cleaner.clean();

    // only 4 directories stat'd successfully, 4 ≤ 5 → no removal
    expect(result).toEqual({ removed: 0, remaining: 4 });
    expect(mockRm).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Tolerance: rm failure → count still removed, remaining adjusted
  // ----------------------------------------------------------------
  it('should continue when rm fails for a directory', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = Date.now();

    const oldest = new Date(now - 100_000);
    const secondOldest = new Date(now - 80_000);
    const ok = new Date(now);

    mockReaddir.mockResolvedValue(['d-old', 'd-older', 'd-ok']);
    mockStat
      .mockResolvedValueOnce(fakeDir(secondOldest))  // d-old
      .mockResolvedValueOnce(fakeDir(oldest))         // d-older → oldest
      .mockResolvedValueOnce(fakeDir(ok));            // d-ok

    // d-older (oldest) fails to delete, d-old succeeds
    mockRm
      .mockRejectedValueOnce(new Error('EPERM'))     // d-older fails
      .mockResolvedValueOnce(undefined);              // d-old succeeds

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 1 });
    const result = await cleaner.clean();

    // 3 total, max 1 → need to remove 2
    // d-older tried first (oldest), fails → not removed
    // d-old tried second, succeeds → removed
    expect(result).toEqual({ removed: 1, remaining: 2 });
    expect(mockRm).toHaveBeenCalledTimes(2);
  });

  // ----------------------------------------------------------------
  // Default maxLogDirs = 100
  // ----------------------------------------------------------------
  it('should use default maxLogDirs of 100', async () => {
    const { mockReaddir, mockStat } = await mockModules();
    const now = new Date();
    const entries = Array.from({ length: 50 }, (_, i) => `dir-${i}`);
    mockReaddir.mockResolvedValue(entries);
    mockStat.mockResolvedValue(fakeDir(now));

    const cleaner = new CommandLogCleaner({ logDir }); // no maxLogDirs
    const result = await cleaner.clean();

    expect(result).toEqual({ removed: 0, remaining: 50 });
  });

  // ----------------------------------------------------------------
  // Integration-style: very large number of dirs (stress test)
  // ----------------------------------------------------------------
  it('should correctly remove oldest when 150 dirs exist with default max 100', async () => {
    const { mockReaddir, mockStat, mockRm } = await mockModules();
    const now = Date.now();

    // 150 directories, ages staggered by 1 minute each
    const entries = Array.from({ length: 150 }, (_, i) => `dir-${i}`);
    mockReaddir.mockResolvedValue(entries);
    // dir-0 oldest (mtime furthest in past), dir-149 newest
    mockStat.mockImplementation(async () =>
      fakeDir(new Date(now - (150 * 60_000) + (entries.indexOf as unknown as number) * 60_000)),
    );

    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 100 });
    const result = await cleaner.clean();

    expect(result.removed).toBe(50);
    expect(result.remaining).toBe(100);
    expect(mockRm).toHaveBeenCalledTimes(50);
  });
});
