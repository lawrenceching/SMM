import { readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../lib/logger';

// ============================================================
// Types
// ============================================================

export interface CommandLogCleanerOptions {
  /**
   * 日志根目录（即 `getLogDir()` 的返回值）。
   * 服务会在其下创建 `commands/<uuid>/main.log` 目录结构。
   */
  logDir: string;

  /**
   * 最多保留的命令日志目录数量，默认为 100。
   */
  maxLogDirs?: number;
}

export interface CleanResult {
  /** 被删除的目录数量 */
  removed: number;
  /** 清理后剩余的目录数量 */
  remaining: number;
}

// ============================================================
// CommandLogCleaner
// ============================================================

/**
 * 启动时清理过期的 command log 目录。
 *
 * 在 `getLogDir()/commands/` 下，每个命令执行会创建一个 UUID 子目录。
 * 当子目录数量超过 `maxLogDirs` 时，按最后修改时间（mtime）升序
 * 删除最旧的目录，直到剩余数量 ≤ maxLogDirs。
 *
 * 容错设计:
 *  - commands/ 目录不存在 → 直接返回 { removed: 0, remaining: 0 }
 *  - 单个目录 stat 失败  → 记录 warning，跳过该目录（不影响排序结果）
 *  - 单个目录删除失败    → 记录 warning，继续处理后续目录
 */
export class CommandLogCleaner {
  private readonly commandsDir: string;
  private readonly maxLogDirs: number;

  constructor(options: CommandLogCleanerOptions) {
    this.commandsDir = path.resolve(options.logDir, 'commands');
    this.maxLogDirs = options.maxLogDirs ?? 100;
  }

  /**
   * 执行清理操作。
   * 幂等：多次调用结果与单次调用一致。
   */
  async clean(): Promise<CleanResult> {
    // 1. 检查 commands/ 目录是否存在
    let entries: string[];
    try {
      entries = await readdir(this.commandsDir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        logger.info(
          { commandsDir: this.commandsDir },
          '[CommandLogCleaner] commands dir does not exist, nothing to clean',
        );
        return { removed: 0, remaining: 0 };
      }
      logger.warn(
        { err, commandsDir: this.commandsDir },
        '[CommandLogCleaner] failed to read commands dir',
      );
      return { removed: 0, remaining: 0 };
    }

    // 2. 筛选出子目录，获取 mtime
    const dirs: { name: string; mtime: Date }[] = [];

    for (const name of entries) {
      const fullPath = path.join(this.commandsDir, name);
      try {
        const st = await stat(fullPath);
        if (!st.isDirectory()) {
          continue; // 跳过非目录项（如 main.log 文件不会出现在这里）
        }
        dirs.push({ name, mtime: st.mtime });
      } catch (err) {
        logger.warn(
          { err, entry: fullPath },
          '[CommandLogCleaner] failed to stat entry, skipping',
        );
        // 跳过无法 stat 的项
      }
    }

    const count = dirs.length;

    // 3. 如果数量未超限，直接返回
    if (count <= this.maxLogDirs) {
      logger.info(
        { count, maxLogDirs: this.maxLogDirs },
        '[CommandLogCleaner] no cleanup needed',
      );
      return { removed: 0, remaining: count };
    }

    // 4. 按 mtime 升序排列（最旧的排在最前面）
    dirs.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

    // 5. 计算并删除超量目录
    const toDelete = dirs.slice(0, count - this.maxLogDirs);
    let removed = 0;

    for (const dir of toDelete) {
      const fullPath = path.join(this.commandsDir, dir.name);
      try {
        await rm(fullPath, { recursive: true, force: true });
        removed++;
      } catch (err) {
        logger.warn(
          { err, dir: fullPath },
          '[CommandLogCleaner] failed to remove directory',
        );
        // 继续删除下一个
      }
    }

    const remaining = count - removed;

    logger.info(
      { removed, remaining, maxLogDirs: this.maxLogDirs },
      '[CommandLogCleaner] cleanup completed',
    );

    return { removed, remaining };
  }
}
