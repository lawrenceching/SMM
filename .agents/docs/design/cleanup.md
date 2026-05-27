# 需求: 启动时清理过期的 Command Log 目录

## 1. 需求描述

当程序启动后，检查 `commands` 日志文件夹（即 `getLogDir()/commands/` 目录）。当该目录下的子目录数量超过 100 个时，按最后修改时间（mtime）升序排列，删除最旧的命令日志目录，直到剩余数量不超过 100 个。

---

## 2. 架构分析

### 2.1 现状

| 关注点 | 说明 |
|--------|------|
| **日志目录结构** | `getLogDir()` → `commands/<uuid>/main.log`，每个 UUID 目录保存一次命令执行的日志 |
| **日志写入者** | `createCommandExecutionLogWriter()` 在 `apps/cli/src/route/commandExecutionLog.ts` |
| **日志读取 API** | `handleCommandLog()` 在 `apps/cli/src/route/commandLog.ts`，通过 HTTP API 读取日志内容 |
| **启动入口** | `apps/cli/index.ts` 中依次: 创建目录 → 初始化日志 → 创建 Server → `server.start()` |
| **Server 构造** | `apps/cli/server.ts` 中 `Server` 类的构造函数注册路由、中间件、Socket.IO 等 |

### 2.2 插入点

清理操作应在 **Server 启动之前、目录创建之后** 执行（在 `index.ts` 中），这样可以在服务对外暴露前完成清理，避免并发删除正在被读取的日志。

```
index.ts 执行流程:
  解析参数 → 创建目录 → ★ 清理 commands 日志目录 → 创建 Server → server.start()
```

---

## 3. 核心类/方法接口设计

### 3.1 `CommandLogCleaner` 类

**文件路径:** `apps/cli/src/utils/CommandLogCleaner.ts`

```typescript
// ============================================================
// CommandLogCleanerOptions
// ============================================================
interface CommandLogCleanerOptions {
  /** 日志根目录（即 getLogDir() 的返回值） */
  logDir: string;
  /** 最多保留的命令日志目录数量，默认为 100 */
  maxLogDirs?: number;
}

// ============================================================
// CleanResult
// ============================================================
interface CleanResult {
  /** 被删除的目录数量 */
  removed: number;
  /** 清理后剩余的目录数量 */
  remaining: number;
}

// ============================================================
// CommandLogCleaner
// ============================================================
class CommandLogCleaner {
  constructor(options: CommandLogCleanerOptions);

  /**
   * 执行清理：若 commands/ 下子目录数 > maxLogDirs，
   * 按 mtime 升序删除最旧的目录，直到剩余 ≤ maxLogDirs。
   *
   * 容错设计:
   *  - commands/ 目录不存在 → 直接返回 { removed: 0, remaining: 0 }
   *  - 单个目录 stat 失败 → 记录 warning，跳过该目录
   *  - 单个目录删除失败 → 记录 warning，继续处理后续目录
   *
   * @returns CleanResult 包含删除数和剩余数
   */
  async clean(): Promise<CleanResult>;
}
```

### 3.2 调用方式

在 `apps/cli/index.ts` 中:

```typescript
// 创建目录后, 启动服务前
import { CommandLogCleaner } from '@/utils/CommandLogCleaner';

const cleaner = new CommandLogCleaner({
  logDir: logDir,       // 来自 getLogDir()
  maxLogDirs: 100,      // 可配置，默认 100
});

const result = await cleaner.clean();
logger.info(`Command log cleanup: removed ${result.removed} dirs, ${result.remaining} remaining`);
```

---

## 4. 流程图

```
┌─────────────────────────────────────────────┐
│              程序启动 (index.ts)              │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   创建必要目录           │
        │   (userData/appData/log) │
        └────────────┬────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  new CommandLogCleaner(    │
        │    logDir, maxLogDirs=100  │
        │  ).clean()                 │
        └────────────┬───────────────┘
                     │
                     ▼
          ╔═══════════════════════╗
          ║  clean() 内部流程     ║
          ╚═══════════════════════╝
                     │
                     ▼
        ┌─────────────────────────┐
        │  构造 commandsDir =      │
        │  path.join(logDir,       │
        │            'commands')   │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  commandsDir 是否存在?   │
        └────┬──────────────┬─────┘
             │ 否           │ 是
             ▼              ▼
    ┌────────────┐  ┌──────────────────────┐
    │ 返回        │  │  readdir(commandsDir) │
    │ removed:0  │  │  获取所有子目录名       │
    │ remaining:0│  └──────────┬───────────┘
    └────────────┘             │
                               ▼
                    ┌──────────────────────┐
                    │  目录数量 ≤ 100?      │
                    └────┬────────────┬────┘
                         │ 是         │ 否
                         ▼            ▼
                ┌────────────┐  ┌─────────────────────────┐
                │ 返回        │  │  遍历每个子目录:          │
                │ removed:0  │  │  stat() 获取 mtime        │
                │ remaining:N│  │  （失败则 warn + 跳过）     │
                └────────────┘  └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │  按 mtime 升序排列        │
                                │  （最旧的排在最前面）       │
                                └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │  计算待删除数量:          │
                                │  toDelete = count - 100  │
                                │  取前 toDelete 个目录     │
                                └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │  遍历待删除目录:          │
                                │  rm(dir, { recursive })  │
                                │  （失败则 warn + 继续）    │
                                └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │  返回 CleanResult        │
                                │  { removed, remaining }  │
                                └─────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  记录清理结果到 logger  │
        │  继续启动 Server        │
        └────────────────────────┘
```

---

## 5. 实现计划

### 5.1 新建文件

| 文件 | 说明 |
|------|------|
| `apps/cli/src/utils/CommandLogCleaner.ts` | 核心清理类 |
| `apps/cli/src/utils/CommandLogCleaner.test.ts` | 单元测试 |

### 5.2 修改文件

| 文件 | 修改点 |
|------|--------|
| `apps/cli/index.ts` | 在 `server.start()` 之前插入清理调用 |

### 5.3 测试要点

1. `commands/` 目录不存在 → 返回 `{ removed: 0, remaining: 0 }`
2. 目录数量 ≤ 100 → 不删除任何目录
3. 目录数量 = 150 → 删除最旧的 50 个，保留 100 个
4. 删除过程中部分目录无法 stat → 跳过无法 stat 的目录，继续处理其他
5. 删除过程中部分目录无法 rm → 跳过，继续删除其他

### 5.4 可配置性

- `maxLogDirs` 默认值 100，可通过构造函数参数覆盖
- 后续可通过用户配置或环境变量 `COMMAND_LOG_MAX_DIRS` 覆盖

---

## 6. 依赖分析

| 依赖 | 用途 |
|------|------|
| `node:fs/promises` (readdir, stat, rm) | 目录遍历、获取 mtime、递归删除 |
| `node:path` (join) | 路径拼接 |
| `@/utils/config` (getLogDir) | 获取日志根目录（由调用方传入，不在此类中导入） |
| `../../lib/logger` | 日志记录 |

该项目已使用 Bun 运行时，`node:fs/promises` 系列 API 在 Bun 中已原生优化，无需额外依赖。
