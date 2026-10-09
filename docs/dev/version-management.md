# 版本管理（Changesets）

本文描述 SMM monorepo 如何用 [Changesets](https://github.com/changesets/changesets) 管理包版本。配置位于仓库根目录 `.changeset/`。

Electron / Docker 的 **GitHub Release 与镜像发布** 见 [发版流程](./release.md)；本文只覆盖本地 bump 版本号相关命令。

---

## 配置要点

| 项 | 值 |
|----|-----|
| CLI | 根目录 `@changesets/cli`（`pnpm changeset` 等） |
| `baseBranch` | `main` |
| `fixed` | `@smm/core`、`cli`、`server`、`ui`、`SMM`（Electron）**同一版本号、一起 bump** |
| `access` | `restricted` |
| `commit` | `false`（version 后需自行 git commit） |

`changeset:version` 会更新各包 `package.json` 的 `version`，并生成/更新对应 `CHANGELOG.md`。发版前请确认 `apps/electron` 与 `apps/docker` 的 `version` 一致（见 [发版流程](./release.md)）。

---

## 根目录脚本

定义于根 `package.json`：

| 脚本 | 实际命令 | 作用 |
|------|----------|------|
| `pnpm changeset` | `changeset` | 交互式添加一条 changeset（选包 + semver） |
| `pnpm changeset:version` | `changeset version && pnpm i && pnpm run build:cli` | 应用待处理 changesets，bump 版本，装依赖，构建 CLI |
| `pnpm changeset:publish` | `changeset publish` | 将已 bump 的包发布到 npm（按包 `private` / 配置决定是否真正 publish） |

脚本名必须是 `changeset:version`（带冒号），不能叫 `version`：pnpm 内置了 `pnpm version`（等价于 `npm version`），同名脚本会被遮蔽。

---

## 常规发布（稳定版）

在仓库**根目录**执行：

```bash
# 1. 描述本次变更（可多次添加多条 changeset）
pnpm changeset
# 选择受影响的包与 bump 类型：patch / minor / major
# 写入 .changeset/<random-name>.md

# 2. 应用 changesets：更新 version + CHANGELOG，并 rebuild CLI
pnpm changeset:version

# 3. 检查 diff，自行提交
git add -A
git commit -m "chore: version packages"

# 4. （如需发 npm）发布
pnpm changeset:publish
```

`fixed` 组内任一包被选中 bump 时，组内其余包会升到同一版本。

之后按 [发版流程](./release.md) 用 GitHub Actions 发布 Electron / Docker。

---

## 预发布版本（`-rc.N`）

本仓库预发布统一使用 **`rc`** tag，版本形如 `1.4.17-rc.0`、`1.4.17-rc.1`（即后缀 `-rc.N`，`N` 从 `0` 递增）。

### 进入预发布

```bash
pnpm changeset pre enter rc
```

会在 `.changeset/pre.json` 记录预发布状态（`"tag": "rc"`）。此后再跑 `pnpm changeset:version`，版本会带上 `-rc.0`、`-rc.1` …

完整示例：

```bash
pnpm changeset pre enter rc
pnpm changeset                 # 添加变更说明
pnpm changeset:version         # 例如 → 1.4.17-rc.0
# commit …
pnpm changeset:publish         # npm dist-tag 为 rc（非 latest）
```

同一预发布周期内再次 `changeset:version` → `1.4.17-rc.1`、`-rc.2` …

### 退出预发布 → 稳定版

```bash
pnpm changeset pre exit        # 只标记退出意图，不立刻改版本号
pnpm changeset:version         # 去掉 -rc.N，打成稳定版（如 1.4.17）
# commit …
pnpm changeset:publish         # dist-tag 回到 latest
```

### 注意

- 预发布是**整仓**进入 pre mode，不能只对某一个包开启。
- `fixed` 组仍会一起 bump 为同一 `-rc.N` 版本。
- 预发布版本一般不满足 `^x.y.z` 这类 semver 范围；依赖方可能需要显式装预发布号。
- 不要改用 `dev` / `beta` 等其它 tag；本仓库约定固定为 `rc`。
- 临时试装可用 snapshot：`pnpm exec changeset version --snapshot`（偏一次性测试，不适合正规 rc 流程）。

官方说明：[Prereleases](https://changesets.dev/guide/prereleases)

---

## 常用辅助命令

```bash
# 查看当前待处理 changesets / 发布计划
pnpm exec changeset status

# 进入 / 退出预发布（见上一节）
pnpm exec changeset pre enter rc
pnpm exec changeset pre exit
```

---

## 与发版流程的关系

| 阶段 | 工具 |
|------|------|
| 写变更说明、bump `package.json` / CHANGELOG | 本文 Changesets |
| 创建 Git tag、GitHub Release、推 Docker 镜像 | [发版流程](./release.md) |

建议顺序：先在 `main` 上完成 `changeset:version` 并合并 → 确认 Electron / Docker 版本一致 → 再触发 Release workflow。
