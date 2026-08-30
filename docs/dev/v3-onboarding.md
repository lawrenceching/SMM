# The process of onboarding v3

## Prepare for Testing

添加 "E2E_SMM_V3" 环境变量
当 E2E_SMM_V3 为 true 时, apps/e2e 下的 wdio 测试开始前, 注入 localStorage "smm.v3.enabled".

## Features

V: passed
X: failed

### Import Folders

| Web UI | Electron | ohos | CLI |
|--|--|--|--|
|V|V||V|

## Checklist

[x] MCP tests

[ ] All e2e tests pass when v3 is enabled
[ ] All test/mcp tests pass

