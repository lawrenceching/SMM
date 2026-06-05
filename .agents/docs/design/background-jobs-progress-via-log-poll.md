# BackgroundJobsPopover 改用 Command Log 轮询解析 yt-dlp progress

## 1. Background

yt-dlp 通过 CLI 流式 NDJSON 实时输出 progress (`% / speed / ETA`). UI 通过 `onProgress` callback 把这些字段 patch 进 `useBackgroundJobsStore` + IDB. IDB poll 拉回旧值覆盖 in-memory 状态, 导致 BackgroundJobsPopover 进度条 + 速度被回退到 0.

**根本问题**: 实时 transient 字段混进了持久化数据 (`data.activeVideoProgress / data.downloadSpeedBps / data.downloadEtaSeconds`).

**新方向 (用户提出)**: 不再让 `onProgress` callback 写 store 字段, 改为从 **CLI Command Log 持续轮询** 解析 progress. 日志就是 source of truth, 所有 UI 入口 (LogDialog, PopoverList) 看同一份数据.

**Hook 命名约定**:
- `useCommandLogQuery` — 泛型, 任何命令的日志轮询都能用 (LogDialog 已用同样模式)
- `useYtdlpDownloadProgressQuery` — yt-dlp 专用, 解析日志 segments 里的 progress JSON 行

## 2. 已存在的基础设施 (为什么这个方向成立)

| 能力 | 现状 | 位置 |
|------|------|------|
| Command Log 端点 | `GET /api/command-log/:executionId` (支持 `offset` 增量读) | `apps/cli/src/route/commandLog.ts` |
| Fetch helper | `fetchCommandLogSegments` / `fetchCommandLogRaw` | `apps/ui/src/api/commandLog.ts` |
| TanStack Query 轮询 | `LogDialog` 已经在用, `refetchInterval: 2000` | `apps/ui/src/components/dialogs/LogDialog.tsx:65` |
| 解析 log segments | `parseCommandLogToSegments` 已经在 CLI 端把日志切分为 `{kind, ts, body}` 段 | `apps/cli/src/route/commandLog.ts:37` |
| progress JSON 解析 | `parseYtdlpProgressLine` (CLI 端) — UI 端需要镜像 | `apps/cli/src/route/executeCmd.ts` |
| 执行 ID 关联 | 每个 video 一个 `executionId`, 存在 `job.data.executionId` | `JobOrchestratorProvider.tsx:434` |

**关键观察**: 用户实测 LogDialog 已经能正确显示实时 progress 日志. **PopoverList 完全可以用同样的轮询方式获取 progress**, 因为它和 LogDialog 拉的是同一份日志.

## 3. App Level Architecture

### 3.1 Before (当前 - 失败架构)

```
yt-dlp 进程
   ↓ PTY stdout
CLI executeCmd.ts
   ├─→ NDJSON stream (response body) ──→ UI onProgress callback
   │                                       ├─ patchJob(jobId) → useBackgroundJobsStore
   │                                       └─ 写入 job.data.{activeVideoProgress, ...} → IDB
   └─→ cmdLog.appendStdout(text) ──→ main.log
                                          ↑
                                          │  (IDB poll 每 5s)
                                          │  syncFromIndexedDB('poll')
                                          ↓
                              IDB 拉回旧 record → 覆盖 store → UI 归零 ❌
```

**bug 路径**: 实时值只在 in-memory store, IDB 没有, poll 拉回 stale record 覆盖 fresh store.

### 3.2 After (新架构 - 日志作 source of truth)

```
yt-dlp 进程
   ↓ PTY stdout
CLI executeCmd.ts
   ├─→ NDJSON stream (response body) ──→ UI onProgress callback (只用于"快路径"提示, 可选)
   └─→ cmdLog.appendStdout(text) ──→ main.log ← 单一日志源
                                          ↑
                                          │  (TanStack Query, 2s poll while running)
                                          ↓
                       apps/ui useCommandLogQuery(executionId, format='segments')
                                          ↓
                       apps/ui useYtdlpDownloadProgressQuery(executionId, isRunning)
                                          ↓ (parse segments, 提取最新 progress JSON)
                       派生 progress state (不写 IDB, 不写 store)
                                          ↓
                       <BackgroundJobsPopoverList> 读取 → 显示
                       <LogDialog> 读取 (已有) → 显示
```

**关键不变量**:
- IDB 永远**不写、不读** progress 字段
- 日志 (main.log) 是 progress 的**唯一 source of truth**
- 任何 UI 入口 (LogDialog, PopoverList) 走相同的 queryKey, 共享 TanStack Query cache
- `onProgress` callback 可以保留 (用于即时反馈), 也可以删除 (统一走轮询)

## 4. User Stories

### 4.1 实时进度显示 (PopoverList 始终能看见)

* **Given** 用户通过 DownloadVideoDialog 启动 yt-dlp 下载
* **When** yt-dlp 持续输出 progress NDJSON 到 main.log
* **Then** BackgroundJobsPopover 实时显示进度条 / 速度 / ETA
* **And** IDB poll 不再回退显示 (因为 progress 不在 IDB 路径上)

### 4.2 多 tab 一致性

* **Given** 用户打开 PopoverList, 同时打开 LogDialog
* **When** yt-dlp 输出新 progress
* **Then** 两个 UI 看到**同一份** progress 数据 (共享 query cache)

### 4.3 LogDialog 已有行为不变

* **Given** 用户打开 LogDialog
* **When** yt-dlp 输出新日志
* **Then** LogDialog 继续正常滚动 (新方案对它是 additive, 不破坏)

### 4.4 取消 / 完成后状态清理

* **Given** yt-dlp 进程结束 (exit 0 / 1 / killed)
* **When** BackgroundJobsPopover 显示
* **Then** progress / speed / ETA 立即消失 (轮询 enabled 关闭, derived state 自然消失)

## 5. Tasks

### 5.1 抽出共享的 `useCommandLogQuery` hook (泛型)

- [ ] `apps/ui/src/hooks/useCommandLogQuery.ts` (新建)
  - 接受 `{ executionId: string; isRunning: boolean; format?: 'raw' | 'segments' }`
  - 用 TanStack Query:
    - `queryKey: ['command-log', executionId, format]`
    - `enabled: !!executionId && isRunning`
    - `refetchInterval: isRunning ? 2000 : false`
    - `staleTime: isRunning ? 0 : Infinity`
  - 返回 `{ segments, raw, meta, isPending, error }`
  - **缓存共享**: 同一 executionId 多个组件调用, 触发一次请求
  - 单元测试: 不同 isRunning 时 refetchInterval 切换; 卸载时停止轮询

- [ ] `apps/ui/src/components/dialogs/LogDialog.tsx`
  - 把内部 `useQuery({...})` 改为 `useCommandLogQuery(...)`
  - 行为完全保持 (LogDialog 已在用同样模式)

### 5.2 抽出 yt-dlp progress 解析 hook

- [ ] `apps/ui/src/hooks/useYtdlpDownloadProgressQuery.ts` (新建)
  - **专门解析 yt-dlp 输出的 progress JSON 行**, 对其他命令无意义
  - 接受 `{ executionId: string; isRunning: boolean }`
  - 内部调 `useCommandLogQuery({ executionId, isRunning, format: 'segments' })`
  - 从 `segments` 中:
    1. 筛 `kind === 'stdout'` 段
    2. 按行分割 body
    3. 找以 `{` 开头并 `JSON.parse` 成功
    4. 检查 `status === 'downloading' | 'finished'`
  - 保留**最新一条**符合的 (因为日志按时间追加, 后追加的覆盖前者)
  - 返回 `{ percent: number; speedBps: number; etaSeconds: number | null; status: 'downloading' | 'finished' | null; updatedAt: number } | null`
  - **不写任何 store** — 纯 derived state
  - 单元测试 `useYtdlpDownloadProgressQuery.test.ts`:
    - 给一组 segments, 返回最新 progress
    - 多个 video 切换时 (新 executionId segments 出现), 返回**最新一条**
    - 没有 progress 行时返回 null
    - JSON 解析失败 (yt-dlp 错误输出夹带) 时跳过不崩

- [ ] 命名说明: `useYtdlpDownloadProgressQuery` (而不是泛型的 `useCommandLogProgress`) 是因为:
  - progress JSON 格式是 yt-dlp 特有的 (自定义模板)
  - 解析逻辑跟具体命令耦合
  - 其他命令 (ffmpeg, etc.) 进度格式不同, 不应共用此 hook

### 5.3 PopoverList 用新 hook 渲染

- [ ] `apps/ui/src/components/background-jobs/BackgroundJobsPopoverList.tsx`
  - 每个 download-video job item 内部:
    - 读 `job.data.executionId` (通过 `getJobExecutionId(job)`)
    - 读 `job.status` 判断 `isRunning = job.status === 'running'`
    - 调 `useYtdlpDownloadProgressQuery({ executionId, isRunning })`
    - 把渲染用的 `progress` / `speedBps` / `etaSeconds` 替换为 hook 返回值
  - **删除** 所有 `job.data.activeVideoProgress` / `job.data.downloadSpeedBps` / `job.data.downloadEtaSeconds` 的引用
  - 渲染逻辑:
    - Progress bar: `progress?.percent ?? job.progress` (hook 没值就回退 IDB 的整体进度)
    - Speed: `progress?.speedBps` (无值则不渲染)
    - ETA: `progress?.etaSeconds` (无值则不渲染)
  - 数据来源完全明确: `job.progress` 来自 IDB 整体进度, `progress.*` 来自日志轮询

- [x] `apps/ui/src/components/background-jobs/BackgroundJobsPopoverList.test.tsx` (4 tests, 改用 mock hook)
  - 测试 "speed/ETA from log polling" ✅
  - 测试 "fallback to job.progress when log has no progress yet" ✅
  - 测试 "no speed/ETA when log returns null" ✅

### 5.4 删除 transient 字段 ✅

- [x] `apps/ui/src/types/background-jobs.ts`
  - 删除 `activeVideoProgress / downloadSpeedBps / downloadEtaSeconds` (3 个字段 + JSDoc)
- [x] `apps/ui/src/lib/jobRecordMapper.ts`
  - 删除对应的 3 个 if 块 (mapper 不再反序列化这些字段)
- [x] `apps/ui/src/lib/jobRecordMapper.test.ts`
  - 替换为 "does not deserialize transient progress fields" 测试 (验证即被忽略)

### 5.5 简化 JobOrchestratorProvider ✅

- [x] `apps/ui/src/components/JobOrchestratorProvider.tsx`
  - `handleYtdlpProgress` 变为 no-op (仅保留签名以兼容 callback)
  - 删除 `data.activeVideoProgress / downloadSpeedBps / downloadEtaSeconds` 写入
  - 删除 `useBackgroundJobsStore.getState().patchJob(...)` 整块
  - 删除 `record.data = JSON.stringify(data)` / `record.updatedAt = Date.now()` / `await putJob(record)` / `await syncFromIndexedDB(...)` 四行
  - 删除 onSuccess 中 `delete dd.*` (line 470-473)

### 5.6 (可选) 简化 CLI 端 NDJSON 协议

- [ ] `apps/cli/src/route/executeCmd.ts`
  - **如果** UI 端确定不用 `onProgress` callback, 可以在 CLI 端不构造 `{type: 'progress'}` NDJSON
  - 简化为只发 `{type: 'stdout'}` (PTY 输出原文)
  - 客户端解析 progress JSON 在日志轮询路径上完成
  - 优点: CLI 端逻辑更少
  - 缺点: UI 端没有"流式即得 progress"的快路径, 完全依赖 2s 轮询
  - **决策**: 暂不删除 `onProgress` callback, 但允许 UI 端不用它. 给未来的优化留空间.

## 6. Backward Compatibility

### 6.1 IDB 兼容

- 旧 IDB 记录可能含 `activeVideoProgress / downloadSpeedBps / downloadEtaSeconds`
- 新代码不读这些字段 — **忽略即可**, 无需数据迁移
- 新 IDB 写入路径 (JobOrchestratorProvider) 不会写这些字段 — 旧字段会随时间自然消失 (旧 job 完成后删)

### 6.2 API 兼容

- `fetchCommandLogSegments` / `fetchCommandLogRaw` 不变
- `/api/command-log/:executionId` 端点不变
- `useCommandLogQuery` / `useYtdlpDownloadProgressQuery` 是纯新增

### 6.3 类型变化

- `DownloadVideoBackgroundJobData` 删除 3 个字段 (internal type, 无外部 consumer)
- 任何代码直接读 `job.data.activeVideoProgress` 等会 TS 报错, **这就是好事** (compile-time 强制迁移)

## 7. Documents

- [ ] `docs/api/index.md` — `useCommandLogQuery` / `useYtdlpDownloadProgressQuery` 不是 API, 不需要更新
- [ ] 设计文档本身已记录

## 8. Post Verification

- [x] 单元测试: `pnpm run test` — 116 files, 1054 tests pass (max in project history)
  - BackgroundJobsPopoverList.test.tsx: 4 tests ✅
  - BackgroundJobsPopoverContent.test.tsx: 10 tests ✅
  - download-video-dialog.executeCmd.test.tsx: 1 test ✅
  - useCommandLogQuery.test.tsx: 5 tests ✅
  - useYtdlpDownloadProgressQuery.test.tsx: 15 tests ✅
- [x] TypeScript: `pnpm typecheck` — no errors from changed files
- [x] Build: `pnpm build` — UI 编译通过
- [ ] **手动 e2e (pending)**:
  - 启动 SMM, 触发 yt-dlp 下载
  - **关键**: 进度条持续显示 ~30 秒, 不再中途归零
  - 打开 LogDialog, 看到完整日志, PopoverList 与之同步
  - 多 video 切换时, 进度平滑过渡
  - 取消下载 → 进度消失
  - 刷新页面 → job 仍在 IDB, progress 清空 (因为日志轮询依赖 in-flight executionId)

## 9. 架构优势总结

| 维度 | 之前 (onProgress callback) | **新方案 (日志轮询)** |
|------|---------------------------|---------------------|
| 单一 source of truth | ❌ (Zustand store + IDB 两份) | ✅ (main.log) |
| 多 tab 一致性 | ❌ (各 tab 各自 store) | ✅ (TanStack Query cache 共享) |
| 持久化边界清晰 | ⚠️ (transient 字段混在 data 里) | ✅ (IDB 只存配置; 进度只来自日志) |
| 已有基础设施复用 | ❌ (要新写 RuntimeProgressStore) | ✅ (command-log API + TanStack Query 现成) |
| 测试难度 | ⚠️ (新 store + 解析都要测) | ✅ (只测解析 + mock hook) |
| 调试能力 | ⚠️ (要单独看 store) | ✅ (LogDialog 和 PopoverList 看同一份) |
| 未来扩展 (其他 job 类型) | ❌ (要逐个 type 加) | ✅ (只要有 progress JSON 就能用) |
| 跨刷新一致性 | ❌ (transient 不持久化) | ⚠️ (日志文件留存, 但 ephemeral session 失效) |

**唯一 trade-off**: 跨刷新后, 进度数据丢失 (因为轮询依赖 in-flight `executionId` 状态). 这是**预期行为** — 进程仍在跑, 但 UI 不再知道实时进度, 用户可以打开 LogDialog 看完整历史.

## 10. 实施顺序

按依赖关系, 实施顺序:

1. **5.1** 抽出 `useCommandLogQuery` (基础设施, 不影响现有功能)
2. **5.2** 抽出 `useYtdlpDownloadProgressQuery` (解析逻辑, 单元测试覆盖)
3. **5.3** 改 PopoverList 使用新 hook (这是用户能感知到的修复)
4. **5.4** 删除 transient 字段 (编译时强制, 但要先确认所有引用都改完)
5. **5.5** 简化 JobOrchestratorProvider (删 `patchJob` / `delete dd.*` / IDB 写入)
6. **手动 e2e 验证** (第 8 节)
7. (可选) **5.6** 简化 CLI 端 NDJSON 协议 (后续优化, 留作 follow-up)

## 11. 依赖图 (实施前确认)

```
BackgroundJobsPopover (UI 组件)
        │ 消费
        ▼
useYtdlpDownloadProgressQuery(executionId, isRunning)
        │ 消费
        ▼
useCommandLogQuery(executionId, format='segments')
        │ 调
        ▼
fetchCommandLogSegments(executionId)  ← 纯函数 (已有)
        │ HTTP GET
        ▼
CLI: GET /api/command-log/:executionId  ← 已有
        │ 读
        ▼
main.log  ← 已有
```

**所有底层都已存在**, 这次改动**纯前端**:
- 新增 2 个 hook
- 改 1 个 UI 组件
- 删 3 个 type 字段
- 简化 1 个组件的回调
