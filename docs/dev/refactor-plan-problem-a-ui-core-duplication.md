# 重构计划：问题 A — UI 与 core-app pipeline 重复实现

**关联报告：** [report.md](../../report.md) §4.2-A、§8-P0-1  
**目标架构：** [overview.md](./overview.md) — 业务逻辑集中在 Core，UI 为薄层  
**范围：** 消除 UI 与 `apps/core/src/pipeline` 的重复实现  

**架构修正（2026-09-01）：**  
`apps/core` **整体按设计即平台无关**（平台能力经 FsPort / NetworkPort 等注入）。  
因此 **不需要** 再拆 `pure/` 目录；UI 应直接 `import` `@smm/core/pipeline/*`。  
下文若仍出现 `pure/`，以本节为准（历史方案已撤销）。

**实施进度：**  
- UI 删除重复实现，改引用 pipeline  
- `renameRules` 保留 movie 支持（合并后的 SSOT）  
- A8/A9/A10（legacy 编排）仍待后续  

---

## 1. 背景与问题陈述

`apps/ui/src/lib` 与 `apps/core/src/pipeline` 存在多组 **同名、同职责** 实现。两侧各有单元测试，行为已出现分叉（例如 `renameRules`：UI 支持 movie，Core 对非 TV 抛错；`findAssociatedFiles`：UI 返回带 tag 的 `File[]`，Core 返回 POSIX 路径字符串）。

继续双轨维护会导致：

- Bug 修一处、漏一处  
- UI 预览重命名与 CLI/AI 实际执行结果不一致  
- 删除 legacy 路径时无法安全删 UI 副本（不知 Core 是否已覆盖）

---

## 2. 设计原则

### 2.1 三层分流（每个模块必须归类）

| 层级 | 放置位置 | UI 消费方式 |
|------|----------|-------------|
| **Pure** | `@smm/core/pure/*`（新建，见 §3） | 直接 import（浏览器可打包） |
| **Core pipeline** | `apps/core/src/pipeline/*` | 仅 CLI/Electron；UI 走 HTTP |
| **UI-only** | `apps/ui/src/types`、`stores` | 保留（如 `UIMediaMetadata.status`） |

**禁止：** UI 再新增与 pipeline 同名的 `lib/*` 文件。

### 2.2 单一事实来源（Single Source of Truth）

1. **Pure 函数** → 只存在于 `@smm/core/pure`  
2. **core-app pipeline** → `import` pure 模块，删除 pipeline 内联副本  
3. **UI** → `import` 同一 pure 模块，或调用已有 v3 API  

### 2.3 浏览器边界

`apps/core` 部分文件依赖 `node:crypto`、`FsPort` 等，**不可**通过 barrel `@smm/core` 整体打进 UI bundle。

新建 **`apps/core/src/pure/`** 子目录：

- 仅允许依赖：`@smm/types`、`@smm/utils`、标准 Web API  
- 禁止：`node:*`、`FsPort`、`NetworkPort`  
- 在 `apps/core/package.json` 增加 exports：

```json
"./pure/*": "./src/pure/*.ts"
```

UI tsconfig 已有 `@smm/core/*` → `../core/src/*`，无需改路径别名。

### 2.4 语义合并规则（先于搬家）

| 模块 | 当前分叉 | 合并决策 |
|------|----------|----------|
| `renameRules` | UI 支持 movie | **以 UI 行为为准扩展 Core**（movie 文件名生成是产品能力） |
| `findAssociatedFiles` | UI 返回 `File[]` + tag | **保留 Core 的 string[] 算法**；UI 的 tag 包装为薄 adapter `toTaggedAssociatedFiles()` 留在 UI |
| `assetImageUrls` | UI 用 localStorage debug | **以 Core 为准**（`overrideDefaultTmdbAssetServerHost` 选项参数） |
| `recognizeEpisodes` | UI 多 console.log | **以 Core 为准**；日志由调用方负责 |
| `buildTvShowRenameListForPlan` | UI 用手写 subtitle ext 逻辑 | **以 Core 为准**（`getFullExtensionForAssociatedFile`） |

---

## 3. 模块清单与迁移策略

| # | 模块 | UI 引用点（约） | 迁移策略 | 优先级 |
|---|------|-----------------|----------|--------|
| A1 | `mediaFilePathEqual` | 2 | 移入 pure；两侧删副本 | P0 |
| A2 | `renameRules` | 2 | 合并 movie 支持 → pure | P0 |
| A3 | `assetImageUrls` | 2 API | pure + UI 删 localStorage 分支 | P1 |
| A4 | `findAssociatedFiles` | 6+ | pure（Core 版）+ UI tag adapter | P1 |
| A5 | `buildTvShowRenamePlanFileEntries` | 1 hook | pure | P1 |
| A6 | `buildTvShowRenameListForPlan` | 1 action | pure | P1 |
| A7 | `recognizeEpisodes` | 4+ | pure（含 worker 仅 re-export） | P2 |
| A8 | `downloadScrapeImage` | 2 hooks | **不迁入 pure**；随 legacy 刮削删除（§6） | P2 |
| A9 | `nfo` parse | 6+ | 分阶段：先统一 `parseNfo`；DOM 解析后续 | P2 |
| A10 | `recognizeMediaFolder` | 2 hooks + pipeline | **不迁入 pure**；UI 删副本，改走 Core HTTP | P3 |

---

## 4. 分阶段实施

### Phase 0 — 基线与防护（1–2 天）

**目标：** 可证明「合并前后行为一致」，并防止回退。

| 任务 | 内容 |
|------|------|
| 0.1 | 建立 **golden tests**：从 UI/Core 两侧现有 `.test.ts` 抽取相同输入/期望，放到 `apps/core/src/pure/__tests__/parity/` |
| 0.2 | 记录 **语义 diff 表**（§2.4）写入 PR 描述模板 |
| 0.3 | 添加 ESLint 规则（或 CI script）：禁止 `apps/ui/src/lib` 新增与 `apps/core/src/pipeline` **basename 相同** 的 `.ts` 文件 |
| 0.4 | 跑通 `pnpm typecheck` + `pnpm test:core-app` + `pnpm test:ui` 作为每阶段 gate |

**完成标准：** parity 测试红灯（尚未实现 pure）→ 实现后变绿。

---

### Phase 1 — Pure 包骨架 + P0 模块（2–3 天）

**目标：** 最先合并 **零分叉** 或 **分叉已决策** 的模块。

#### 1.1 创建目录结构

```
apps/core/src/pure/
  mediaFilePathEqual.ts
  renameRules.ts
  assetImageUrls.ts
  findAssociatedFiles.ts
  buildTvShowRenamePlanFileEntries.ts
  buildTvShowRenameListForPlan.ts
  recognizeEpisodes.ts
  index.ts          # 仅 re-export，不含 Node API
  __tests__/
```

#### 1.2 实施顺序

```
A1 mediaFilePathEqual
  → A2 renameRules（合并 movie）
  → A4 findAssociatedFiles
  → A5 buildTvShowRenamePlanFileEntries
  → A6 buildTvShowRenameListForPlan
  → A3 assetImageUrls
  → A7 recognizeEpisodes
```

#### 1.3 每个模块的标准 PR 步骤

1. 将 **canonical 实现** 写入 `apps/core/src/pure/<name>.ts`  
2. `apps/core/src/pipeline/**` 改为 `import { ... } from "../pure/<name>"`（或相对路径）  
3. `apps/ui` 改为 `import { ... } from "@smm/core/pure/<name>"`  
4. 删除 `apps/ui/src/lib/<name>.ts` 及对应 `.test.ts`  
5. 将 parity 测试迁至 `apps/core/src/pure/__tests__/`  
6. 跑 typecheck + ui/core-app 测试  

#### 1.4 UI 特有问题

**`findAssociatedFiles` tag 包装：**

```typescript
// apps/ui/src/lib/associatedFilesUi.ts（新文件，非 duplicate basename）
import { findAssociatedFiles as findAssociatedPaths } from "@smm/core/pure/findAssociatedFiles"
// map paths → UI File[] with SUB/AUD/NFO/POSTER tags
```

更新 `utils.ts`、`buildTvShowEpisodeTableRows.ts` 等调用点。

**`recognizeEpisodes.worker.ts`：**

Worker 内 import 改为 `@smm/core/pure/recognizeEpisodes`，删除 worker 内联 pattern 副本。

**完成标准：**

- [ ] P0/P1 pure 模块在 UI 中 **零** `apps/ui/src/lib/<duplicate>.ts`  
- [ ] `apps/core/src/pipeline` 对应文件变为 re-export 或删除  
- [ ] parity 测试全绿  

---

### Phase 2 — 重命名预览与 Plan 链路收敛（2 天）

**背景：** `useTvShowFileNameGeneration` 在 UI 本地调用 `buildTvShowRenamePlanFileEntries` 做 **预览**；执行 plan 时 `applyRenameFilesPlanForTvShow` 本地展开关联文件。

Phase 1 完成后，预览与执行已共用 pure 算法，但仍有 **双路径 API**：

| 步骤 | 现状 | 目标 |
|------|------|------|
| 生成 plan 文件列表 | UI pure import | 保持 pure import（预览需同步、低延迟） |
| 持久化 plan | `createRenameEpisodePlanApi` → Core | 已符合架构 ✓ |
| 执行 rename | `buildTvShowRenameListForPlan` + `/api/renameFiles` | pure 统一后行为与 Core `applyRenameFilesPlan` 一致 |

**可选增强（非阻塞）：** 新增 `POST /api/preview-rename-episode-plan` 返回 `{ files }`，供 E2E 验证 UI 与 Core 完全一致；**不是 Phase 2 必需**。

**完成标准：**

- [ ] `MoviePanel` / `useTvShowFileNameGeneration` 使用 `@smm/core/pure/renameRules`  
- [ ] `applyRenameFilesPlanForTvShow` 使用 pure `buildTvShowRenameListForPlan`  
- [ ] 现有 `apps/ui` / `apps/e2e` 重命名相关用例通过  

---

### Phase 3 — NFO 解析统一（2–3 天）

**范围：** 仅 **识别用** 的 NFO 解析，不含刮削 **生成** NFO（属 report 问题 B/C）。

| 任务 | 内容 |
|------|------|
| 3.1 | 识别 mutation（`useRecognize*ByNfoMutation`）改用 `@smm/core/pure/parseNfo` 或 Core 已导出的 `parseNfo` |
| 3.2 | 评估 UI `lib/nfo/*` DOMParser 是否可替换为 pure regex/XML 子集；若不能，保留 UI 模块但 **改名** 为 `nfoDomParser.ts`，避免与 Core `nfo.ts` 混淆 |
| 3.3 | 删除 UI 中与 Core `parseNfo` 重复的 id 提取逻辑 |

**完成标准：**

- [ ] NFO 识别路径不再维护第二套 id 解析  
- [ ] `lib/nfo/` 职责在文件头注释中标注：`UI 展示/编辑用 DOM 解析，非 SSOT`  

---

### Phase 4 — 删除编排级 duplicate（3–5 天，依赖 legacy 退役）

**模块：** A10 `recognizeMediaFolder`、A8 `downloadScrapeImage`

这两类 **依赖网络/文件 I/O**，不应进入 pure；正确做法是 UI **只调用 Core HTTP**。

| 模块 | UI 删除前提 | 替代 API |
|------|-------------|----------|
| `recognizeMediaFolder.ts` | legacy 初始化 hook 改为 v3 编排 | 已有 `/api/recognize-folder`；需补 **一键 import+recognize** API（见 report §9 短期-3） |
| `downloadScrapeImage.ts` | legacy 刮削路径删除 | v3 `/api/scrape` job（已存在） |

**执行顺序：**

1. 确认 `isSmmV3Enabled()` 在生产/CI 恒为 true  
2. 删除 `handleStartLegacy` 等调用链  
3. 删除 UI 副本文件  
4. 收缩 `useInitializeImportedMediaFolder` 为调用 Core job API  

**完成标准：**

- [x] UI 无 `recognizeMediaFolder.ts`、`doPreprocessMediaFolder`（已删；init 走 mutations / Core pipeline）
- [ ] UI 无 `downloadScrapeImage.ts`  
- [ ] 识别/刮削 E2E 仅覆盖 v3 路径  

---

### Phase 5 — 防护与文档（1 天）

| 任务 | 内容 |
|------|------|
| 5.1 | 更新 [AGENTS.md](../../AGENTS.md)：`@smm/core/pure` = 浏览器可共享 domain；`apps/core/pipeline` = Node Core |
| 5.2 | 更新 [overview.md](./overview.md) 脚注：Pure 子层说明 |
| 5.3 | CI：`pnpm test:core-app` 必跑；可选添加 `scripts/check-ui-core-duplicate-basenames.ts` |
| 5.4 | 关闭 report 问题 A，勾选验收清单 |

---

## 5. 测试策略

遵循项目 **red-green** 原则（见 `.cursorrules`）：

1. **Phase 0** 先写 parity 测试（当前应对 UI/Core 两份实现跑同一 fixture，Document expected; after merge single impl）  
2. 合并 movie `renameRules` 时，**先**在 pure 测试中断言 movie case，再改 Core pipeline 行为  
3. 每个 Phase 结束跑：

```bash
pnpm typecheck
cd apps/core && pnpm test
cd apps/ui && pnpm test
# 相关 e2e（按需）
bun ci/run-e2e-test.ts --spec ./test/specs/...Rename...
```

4. **关键 E2E 回归面：**

| 能力 | 建议 spec |
|------|-----------|
| TV 规则重命名预览 | TV panel rename flow |
| Plan 创建/应用 | plan / rename e2e |
| 导入识别 | ImportTvShowLibrary.e2e.ts |
| 刮削 v3 | scrape dialog e2e |

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Vite 误打包 Node 模块 | pure 目录 CI 检查：禁止 `from "node:` / `FsPort` import |
| `findAssociatedFiles` 行为变化 | parity 测试 + 关联字幕 edge case（`.en.srt`） |
| Worker import `@smm/core/pure` 路径 | Vitest + 浏览器各跑 `recognizeEpisodes.worker` 测试 |
| 大 bang PR | **每模块一个 PR**，按 §4.1.2 顺序合并 |
| legacy 仍被使用 | Phase 4 单独分支；Phase 1–3 不依赖 legacy 删除 |

---

## 7. 工作量与排期（估算）

| Phase | 内容 | 估时 | 可并行 |
|-------|------|------|--------|
| 0 | 基线 + ESLint | 1–2d | — |
| 1 | Pure P0/P1 模块 | 2–3d | 模块级 PR 可并行 |
| 2 | Rename 链路 | 2d | 依赖 Phase 1 |
| 3 | NFO 解析 | 2–3d | 与 Phase 2 部分并行 |
| 4 | 编排 duplicate | 3–5d | 依赖 legacy 退役决策 |
| 5 | 文档 + CI | 1d | — |

**合计：** 约 **11–16 人日**（单人 sequential）；Phase 1 多模块可拆给多人。

---

## 8. 验收清单（问题 A 关闭条件）

- [ ] `apps/ui/src/lib` 不存在与 `apps/core/src/pipeline` 同 basename 的 domain 文件（允许 `*Ui.ts` adapter）  
- [ ] 所有 Pure 模块仅存在于 `apps/core/src/pure/`  
- [ ] `renameRules` movie/TV 行为有单一测试套件  
- [ ] UI 重命名预览与 CLI `createRenameEpisodePlan` 对同一 fixture 产出相同 `files[]`  
- [ ] report.md 问题 A 标记为 **已解决**  

---

## 9. 建议 PR 拆分（可直接开 issue）

| PR | 标题 | 范围 |
|----|------|------|
| #1 | `chore: add pure/ scaffold and parity tests` | Phase 0 + 目录 |
| #2 | `refactor: extract mediaFilePathEqual and renameRules to pure` | A1, A2 |
| #3 | `refactor: extract findAssociatedFiles and rename plan builders to pure` | A4–A6 |
| #4 | `refactor: extract assetImageUrls and recognizeEpisodes to pure` | A3, A7 |
| #5 | `refactor: ui use pure modules, remove lib duplicates` | UI 删文件 |
| #6 | `refactor: unify nfo id parsing for recognition` | Phase 3 |
| #7 | `refactor: remove recognizeMediaFolder and downloadScrapeImage from ui` | Phase 4 |

---

## 10. 附录：当前 UI 引用矩阵

| Pure 模块 | 主要 UI 消费方 |
|-----------|----------------|
| `renameRules` | `MoviePanel.tsx`, `buildTvShowRenamePlanFileEntries` |
| `buildTvShowRenamePlanFileEntries` | `useTvShowFileNameGeneration.ts` |
| `buildTvShowRenameListForPlan` | `applyRenameFilesPlanForTvShow.ts` |
| `recognizeEpisodes` | `useInitializeImportedMediaFolder.ts`, `TvShowPanelUtils.ts`, `LocalFileRow.tsx`, worker |
| `downloadScrapeImage` | `useScrapePosterMutation.ts`, `useScrapeFanartMutation.ts` |
| `assetImageUrls` | `downloadImageWithFailover.ts`, `fetchProxiedImageWithFailover.ts` |
| `mediaFilePathEqual` | `buildTvShowRenamePlanFileEntries.ts`, `buildTvShowEpisodeTableRows.ts` |
| `nfo` | `useHandleScrapeStart.ts`, NFO recognition hooks, `loadNfo.ts` |
| `recognizeMediaFolder` | TVDB id in folder name mutations（间接 via `recognizeMediaFolderByTvdbIdInFolderName`） |

**注：** `recognizeMediaFolderByTvdbIdInFolderName.ts` 等 **helper 文件名** 不在 A 组 basename 列表内，但在 Phase 4 应一并评估是否由 Core 替代。
