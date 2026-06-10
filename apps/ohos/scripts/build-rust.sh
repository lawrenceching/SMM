#!/bin/bash
set -e

if [ -z "$OHOS_NDK_HOME" ]; then
  echo "ERROR: OHOS_NDK_HOME is not set"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUST_DIR="$ROOT/hello_rust"
STRIP="$OHOS_NDK_HOME/llvm/bin/llvm-strip"

chmod +x "$RUST_DIR/aarch64-ohos-clang.sh" "$RUST_DIR/x86_64-ohos-clang.sh"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER="$RUST_DIR/aarch64-ohos-clang.cmd"
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_OHOS_LINKER="$RUST_DIR/x86_64-ohos-clang.cmd"
    ;;
  *)
    export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER="$RUST_DIR/aarch64-ohos-clang.sh"
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_OHOS_LINKER="$RUST_DIR/x86_64-ohos-clang.sh"
    ;;
esac

echo "==> Build aarch64-unknown-linux-ohos"
cd "$RUST_DIR"
cargo build --release --target aarch64-unknown-linux-ohos

echo "==> Build x86_64-unknown-linux-ohos"
cargo build --release --target x86_64-unknown-linux-ohos

ARM64_SO="$RUST_DIR/target/aarch64-unknown-linux-ohos/release/libhello_rust.so"
X86_SO="$RUST_DIR/target/x86_64-unknown-linux-ohos/release/libhello_rust.so"

echo "==> Strip"
"$STRIP" --strip-unneeded "$ARM64_SO"
"$STRIP" --strip-unneeded "$X86_SO"

ARM64_DEST="$ROOT/electron/libs/arm64-v8a"
X86_DEST="$ROOT/electron/libs/x86_64"
mkdir -p "$ARM64_DEST" "$X86_DEST"

echo "==> Copy to electron/libs/"
cp "$ARM64_SO" "$ARM64_DEST/librust_hello.so"
cp "$X86_SO" "$X86_DEST/librust_hello.so"

echo "==> Done. Rebuild HAP in DevEco Studio."
