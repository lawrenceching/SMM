@echo off
if "%OHOS_NDK_HOME%"=="" (
  echo OHOS_NDK_HOME is not set
  exit /b 1
)
"%OHOS_NDK_HOME%\llvm\bin\clang.exe" -target x86_64-linux-ohos --sysroot="%OHOS_NDK_HOME%\sysroot" -D__MUSL__ %*
