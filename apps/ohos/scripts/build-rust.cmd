@echo off
setlocal enabledelayedexpansion

if "%OHOS_NDK_HOME%"=="" (
  echo ERROR: OHOS_NDK_HOME is not set
  echo Example: set OHOS_NDK_HOME=C:\Users\^<user^>\sdk\default\openharmony\native
  exit /b 1
)

set "ROOT=%~dp0.."
set "RUST_DIR=%ROOT%\hello_rust"
set "STRIP=%OHOS_NDK_HOME%\llvm\bin\llvm-strip.exe"

set "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER=%RUST_DIR%\aarch64-ohos-clang.cmd"
set "CARGO_TARGET_X86_64_UNKNOWN_LINUX_OHOS_LINKER=%RUST_DIR%\x86_64-ohos-clang.cmd"

echo ==^> Build aarch64-unknown-linux-ohos
pushd "%RUST_DIR%"
cargo build --release --target aarch64-unknown-linux-ohos
if errorlevel 1 exit /b 1

echo ==^> Build x86_64-unknown-linux-ohos
cargo build --release --target x86_64-unknown-linux-ohos
if errorlevel 1 exit /b 1
popd

set "ARM64_SO=%RUST_DIR%\target\aarch64-unknown-linux-ohos\release\libhello_rust.so"
set "X86_SO=%RUST_DIR%\target\x86_64-unknown-linux-ohos\release\libhello_rust.so"

echo ==^> Strip
"%STRIP%" --strip-unneeded "%ARM64_SO%"
"%STRIP%" --strip-unneeded "%X86_SO%"

set "ARM64_DEST=%ROOT%\electron\libs\arm64-v8a"
set "X86_DEST=%ROOT%\electron\libs\x86_64"
if not exist "%ARM64_DEST%" mkdir "%ARM64_DEST%"
if not exist "%X86_DEST%" mkdir "%X86_DEST%"

echo ==^> Copy to electron/libs/
copy /Y "%ARM64_SO%" "%ARM64_DEST%\librust_hello.so"
copy /Y "%X86_SO%" "%X86_DEST%\librust_hello.so"

echo ==^> Done. Rebuild HAP in DevEco Studio.
endlocal
