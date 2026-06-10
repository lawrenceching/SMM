# hello_rust

HarmonyOS 原生模块 PoC：用 Rust 编译为 `.so`，通过 N-API 供 ArkTS 调用。本 crate 使用 [ohos-rs](https://ohos.rs)（`napi-ohos`），**不是** crates.io 上的上游 `napi-rs`。

上层工程说明见仓库根目录 [README.md](../README.md) 与 [napi-rs-harmonyos-poc.md](../napi-rs-harmonyos-poc.md)。

## 前置条件

1. **Rust** stable ≥ 1.78，安装 OHOS target：

   ```bash
   rustup target add aarch64-unknown-linux-ohos
   rustup target add x86_64-unknown-linux-ohos
   ```

2. **HarmonyOS NDK**（DevEco Studio SDK 自带），设置 `OHOS_NDK_HOME` 指向 `openharmony/native`：

   ```bash
   # Windows
   set OHOS_NDK_HOME=C:\Users\<user>\sdk\command-line-tools\sdk\default\openharmony\native

   # macOS / Linux / Git Bash
   export OHOS_NDK_HOME=/path/to/openharmony/native
   ```

## 构建与复制 .so

推荐在**仓库根目录**执行构建脚本（编译、strip、复制一步完成）：

```bash
# Windows cmd
scripts\build-rust.cmd

# Git Bash / macOS / Linux
bash scripts/build-rust.sh
```

脚本流程：

1. 使用 NDK 中的 `clang` 链接器（`aarch64-ohos-clang.*` / `x86_64-ohos-clang.*`）交叉编译 release
2. 用 `llvm-strip --strip-unneeded` 精简体积
3. 复制并重命名到 ArkTS 模块目录：

   | 编译产物 | 复制目标 |
   |----------|----------|
   | `target/aarch64-unknown-linux-ohos/release/libhello_rust.so` | `electron/libs/arm64-v8a/librust_hello.so` |
   | `target/x86_64-unknown-linux-ohos/release/libhello_rust.so` | `electron/libs/x86_64/librust_hello.so` |

> **命名说明**：Cargo 产出 `libhello_rust.so`（crate 名），HarmonyOS 模块包名是 `librust_hello.so`（见 `electron/src/main/native/librust_hello/oh-package.json5`），构建脚本负责重命名。

### 手动构建（可选）

```bash
cd hello_rust

# Windows Git Bash 需先设置 linker 环境变量，见 scripts/build-rust.sh
cargo build --release --target aarch64-unknown-linux-ohos
cargo build --release --target x86_64-unknown-linux-ohos
```

手动复制时同样 strip 后复制为 `electron/libs/<abi>/librust_hello.so`。

修改 Rust 代码后重新构建，再在 DevEco Studio 中 **Clean → Rebuild → Run**。

## 导出 API（N-API）

| 函数 | 说明 |
|------|------|
| `hello()` | 返回 `"Hello from Rust!"` |
| `startHttpServer(port)` | 后台线程启动 TCP HTTP 服务 |
| `stopHttpServer()` | 停止 HTTP 服务 |
| `registerSelectFileHandler(handler)` | 注册 ArkTS 文件选择回调（`ThreadsafeFunction`） |
| `completeSelectFile(result)` | 文件选择完成后回传 JSON 字符串 |

ArkTS 侧通过 `import ... from 'librust_hello.so'` 调用，类型声明在 `electron/src/main/native/librust_hello/index.d.ts`。

## 内置 HTTP 路由

`startHttpServer` 启动后提供极简 HTTP/1.1 服务（PoC 用，非生产级）：

| 路径 | 说明 |
|------|------|
| `GET /health` | `{"status":"ok"}` |
| `GET /listFiles` | 列出系统 temp 目录文件名 |
| `GET /selectFile` | 通过 TSFN 触发 ArkTS `DocumentViewPicker`，阻塞等待用户选择（最长 120s） |

`/selectFile` 依赖 ArkTS 侧调用 `registerSelectFileHandler` 注册 handler，并在选择完成后调用 `completeSelectFile`。

## 关键技术要点

- **ohos-rs 而非 napi-rs**：鸿蒙 N-API 运行时与上游 `napi-rs` 不兼容，使用 `napi-ohos` / `napi-derive-ohos` / `napi-build-ohos`，否则会出现 `Load native module failed`。
- **`cdylib` 产物**：`Cargo.toml` 中 `crate-type = ["cdylib"]`，编译为动态库供 N-API 加载。
- **NDK 链接器包装**：Cargo 默认找不到 OHOS 工具链，通过 `CARGO_TARGET_*_LINKER` 指向本目录下的 `*-ohos-clang.cmd`（Windows）或 `.sh`（Unix）。
- **跨线程 UI 桥接**：HTTP 在后台线程处理请求；`/selectFile` 用 `ThreadsafeFunction` 切回 JS/UI 线程打开系统文件选择器，再用 `mpsc` channel 阻塞等待 `completeSelectFile` 回传结果。
- **HarmonyOS 模块配置**：除复制 `.so` 外，还需 `electron/src/main/native/librust_hello/oh-package.json5`、`electron/oh-package.json5` 依赖声明，以及 `electron/build-profile.json5` 中 `runtimeOnly.packages`。

## 目录结构

```
hello_rust/
├── Cargo.toml           # 依赖 napi-ohos 1.x，release 开启 LTO
├── build.rs             # napi_build_ohos::setup()
├── src/lib.rs           # N-API 导出 + HTTP 服务
├── aarch64-ohos-clang.* # NDK clang 链接器包装
└── x86_64-ohos-clang.*
```
