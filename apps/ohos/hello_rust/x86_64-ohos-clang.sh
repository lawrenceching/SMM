#!/bin/sh
exec "$OHOS_NDK_HOME/llvm/bin/clang" \
  --target=x86_64-linux-ohos \
  --sysroot="$OHOS_NDK_HOME/sysroot" \
  -D__MUSL__ \
  "$@"
