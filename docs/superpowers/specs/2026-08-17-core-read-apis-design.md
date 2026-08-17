# apps/core 只读查询与移除目录 API 设计

本设计文档描述 `apps/core`（Layer 2 Core）新增的 5 个接口：

`getFolders()`、`unimportFolder(path)`、`getUserConfig()`、`getAppConfig()`、`getMediaMetadata(folder)`。

它们让上层（Layer 1 表现层 / Layer 3 宿主）可以查询媒体库状态、读取配置、读取已导入目录的元数据，并移除已导入的目录，是 `core.importFolder(path, type)` 的配套只读 / 移除接口。

## 1. Background

`apps/core` 目前只暴露 `importFolder(path, type)`（后台运行流水线）与 `getJob(id)`（查询任务状态）。上层尚无方式：

- 查询已导入的媒体目录列表（`userConfig.folders`）；
- 读取用户配置 / 应用配置；
- 读取某个已导入目录的元数据（`<appDataDir>/metadata/*.json` 缓存）；
- 移除一个已导入的目录（从配置中删除 + 清理元数据缓存）。

按 [refactoring.md](../../../refactoring.md) 的目标架构，这些查询与命令都应作为 Core 用例下沉到 Layer 2，表现层通过 HTTP / Socket.IO 间接调用，不直接操作文件。

## 2. Architecture

新方法全部挂在 `Core` 类上，复用已有辅助函数：

- `pipeline/userConfig.ts` 的 `readUserConfig` / `writeUserConfig`；
- `pipeline/paths.ts` 的 `metadataCachePath`。

新增唯一的基础能力是 `FsPort.deleteFile`（`unimportFolder` 需要删除元数据缓存文件），两个既有适配器各加一个实现。

```
Core 类
 ├─ getAppConfig()      → 读构造参数（同步）
 ├─ getUserConfig()     → readUserConfig(fs, appDataDir)
 ├─ getFolders()        → readUserConfig(fs, appDataDir).folders
 ├─ getMediaMetadata()  → fs.exists + fs.readTextFile(metadataCachePath)
 └─ unimportFolder()    → readUserConfig + writeUserConfig + fs.deleteFile(metadataCachePath)
                                │
                                ▼
                        FsPort（适配器实现）
```

依赖方向保持不变：Core 逻辑只依赖 Ports 接口，不直接访问平台 API。

## 3. API 设计

### 3.1 `CoreOptions` 扩展

`getAppConfig()` 返回 `AppConfig { version, userDataDir?, reverseProxyUrl }`，但 Core 目前只知道 `appDataDir`。
`version` / `reverseProxyUrl` / `userDataDir` 是宿主（Layer 3）提供的应用级信息，因此在构造时注入：

```ts
export interface CoreOptions {
  fs: FsPort;
  network: NetworkPort;
  logger?: LoggerPort;
  appDataDir: string;
  /** App version string (e.g. "1.3.8"). getAppConfig() 缺省为 "". */
  version?: string;
  /** Reverse proxy base URL. getAppConfig() 缺省为 null. */
  reverseProxyUrl?: string | null;
  /** getAppConfig() 报告的 userDataDir；缺省回落到 appDataDir。 */
  userDataDir?: string;
}
```

### 3.2 新方法

| 方法 | 同步/异步 | 返回 | 说明 |
|------|-----------|------|------|
| `getAppConfig()` | 同步 | `AppConfig` | `{ version: version ?? "", userDataDir: userDataDir ?? appDataDir, reverseProxyUrl: reverseProxyUrl ?? null }`；不访问 fs |
| `getUserConfig()` | 异步 | `Promise<UserConfig>` | `readUserConfig(fs, appDataDir)`；无文件时返回默认配置合并结果 |
| `getFolders()` | 异步 | `Promise<string[]>` | `(await readUserConfig(...)).folders` |
| `getMediaMetadata(folder)` | 异步 | `Promise<MediaMetadata \| null>` | 读元数据缓存；不存在 / JSON 解析失败返回 `null` |
| `unimportFolder(path)` | 异步 | `Promise<void>` | 从配置移除 + 删除元数据缓存；不在配置中时静默 no-op |

#### `getMediaMetadata(folder: string)`

```ts
async getMediaMetadata(folder: string): Promise<MediaMetadata | null> {
  const posixPath = this.normalizePosix(folder);
  const cachePath = metadataCachePath(this.appDataDir, posixPath);
  if (!(await this.fs.exists(cachePath))) return null;
  try {
    const content = await this.fs.readTextFile(cachePath);
    return JSON.parse(content) as MediaMetadata;
  } catch {
    return null;
  }
}
```

- 语义对齐 core-routes 的 `readMediaMetadataCache`（读 `{appDataDir}/metadata/{sanitized-folder}.json`）。
- **只读缓存、不补 `files`**：`importFolder` 持久化时已剔除 `files` 字段，本方法返回的 `MediaMetadata.files` 保持 `undefined`。上层需要文件清单时应自行 `fs.listFiles`。
- 不做「目录是否已导入」校验：未导入且无缓存 → 返回 `null`，调用方可先用 `getFolders()` 判断。
- 复用 `importFolder` 已有的防御式路径规范化（非法/相对路径在 `Path.posix` 抛错时回落到原字符串）。

#### `unimportFolder(path: string)`

```ts
async unimportFolder(path: string): Promise<void> {
  const posixPath = this.normalizePosix(path);
  const config = await readUserConfig(this.fs, this.appDataDir);
  const folders = config.folders.filter((f) => this.normalizePosix(f) !== posixPath);
  if (folders.length === config.folders.length) return; // 不在配置中，no-op
  await writeUserConfig(this.fs, this.appDataDir, { ...config, folders });
  await this.fs.deleteFile(metadataCachePath(this.appDataDir, posixPath));
}
```

- **匹配按 POSIX 规范化比较**：`importFolder` 存进 `folders` 的是调用方传入的原始路径（平台格式或 POSIX 格式），故对存储项与被删路径两侧都做 `Path.posix` 规范化再比较，两种输入都能命中。
- **幂等**：文件夹不在配置中时直接返回，不写配置、不删缓存（对齐核心层的防御式风格）。
- 只有确认文件夹在配置中才会删除缓存文件，避免误删孤儿文件。

#### 私有辅助 `normalizePosix`

三个方法（`getMediaMetadata`、`unimportFolder`、以及既有的 `importFolder`）都需要「`Path.posix` 失败时回落原字符串」。
新增私有方法统一这一行为；`importFolder` 同步改为调用它（行为不变，纯内联重构）：

```ts
private normalizePosix(path: string): string {
  try {
    return Path.posix(path);
  } catch {
    return path;
  }
}
```

### 3.3 同步/异步边界

- `getAppConfig()` 不访问 fs，**同步**返回。
- 其余 4 个方法都经 fs 读取/写入，**异步**返回。

## 4. FsPort 扩展

`unimportFolder` 需要删除元数据缓存文件，而 `FsPort` 目前只有读 / 写 / 存在 / 列表，没有删除能力。新增：

```ts
export interface FsPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(dir: string): Promise<string[]>;
  /** Delete a file; missing files count as success (idempotent). */
  deleteFile(path: string): Promise<void>;
}
```

`deleteFile` 定义为**幂等**（文件不存在视为成功），与 core-routes 的 `doDeleteFile` / `deleteMediaMetadataCache` 语义一致。

### 4.1 NodejsFsAdapter

```ts
async deleteFile(path: string): Promise<void> {
  try {
    await fsp.unlink(Path.toPlatformPath(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
```

### 4.2 NetworkFsAdapter

映射到既有的 `POST /api/deleteFile`（请求体 `{ path }`，成功返回 `{ data }`，错误返回 `{ error }`）：

```ts
async deleteFile(path: string): Promise<void> {
  const json = await this.post<{ error?: string }>("/api/deleteFile", { path });
  if (json.error !== undefined) throw new Error(json.error);
}
```

## 5. 错误处理

- `getMediaMetadata`：缓存不存在 / 读取失败 / JSON 解析失败 → 返回 `null`（不抛错，对齐 core-routes 语义）。
- `unimportFolder`：不在配置中 → 静默 no-op；写配置或删文件失败 → 正常向上抛错，由调用方处理。
- `getUserConfig` / `getFolders`：读配置失败 → 向上抛错。
- `getAppConfig`：不访问 fs，无失败路径。

## 6. 测试计划

在 `Core.test.ts` 新增 describe（`inMemoryFs` 增加 `deleteFile`：从 map 中删除，不存在时静默成功）：

- `getAppConfig`：注入值原样返回；未注入时 `version=""`、`userDataDir=appDataDir`、`reverseProxyUrl=null`。
- `getUserConfig`：无文件返回默认配置；有文件返回合并后的配置。
- `getFolders`：返回配置中的 folders 列表。
- `getMediaMetadata`：返回缓存元数据；无缓存返回 `null`；缓存 JSON 损坏返回 `null`。
- `unimportFolder`：从配置移除该路径并删除缓存文件；路径不在配置中时 no-op 且不删缓存；平台格式与 POSIX 格式输入都能命中。
- `importFolder` 的防御式路径规范化仍通过既有测试（重构 `normalizePosix` 后行为不变）。

适配器测试：

- `NodejsFsAdapter.test.ts`：`deleteFile` 删除存在文件；ENOENT 静默成功；其他错误向上抛。
- `NetworkFsAdapter.test.ts`：`deleteFile` 调用 `/api/deleteFile`，成功不抛错；返回 `error` 时抛错。

其余 3 个 FsPort 型 mock（`recognizeMediaFolder.test.ts`、`importFolderPipeline.test.ts`、`importFolderPipeline.integration.test.ts`）补上 `deleteFile` 实现以免类型报错。

## 7. 涉及文件

- 改：`apps/core/src/Core.ts`（`CoreOptions` 扩展 + 5 个方法 + `normalizePosix` 私有辅助 + `importFolder` 复用辅助）
- 改：`apps/core/src/ports/FsPort.ts`（`deleteFile`）
- 改：`apps/core/src/adapters/node/NodejsFsAdapter.ts`
- 改：`apps/core/src/adapters/network/NetworkFsAdapter.ts`
- 改：`apps/core/src/Core.test.ts`、`apps/core/src/adapters/node/NodejsFsAdapter.test.ts`、`apps/core/src/adapters/network/NetworkFsAdapter.test.ts`
- 改：`apps/core/src/pipeline/recognizeMediaFolder.test.ts`、`apps/core/src/pipeline/importFolderPipeline.test.ts`、`apps/core/src/pipeline/importFolderPipeline.integration.test.ts`（机械性补 `deleteFile`）
- `apps/core/src/index.ts` 无需改动（方法挂在类上，类型均已导出）

## 8. 不做的事（YAGNI）

- 不在 `getMediaMetadata` 里补 `files` 实时文件清单（上层按需自取）。
- 不做「目录是否已导入」校验（调用方用 `getFolders()` 判断）。
- 不新增独立的服务类（方法足够简单，直接挂 `Core`）。
- 不改动既有流水线 / 识别 / 任务逻辑，仅 `importFolder` 内联复用 `normalizePosix`。
