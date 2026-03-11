# SMM

本项目为多媒体管理桌面应用. 
项目基于 monorepo 管理, 使用 pnpm 作为包管理器.

核心模块
* **packages/core** 浏览器和 Node.js 端通用的核心代码
* **apps/ui** 基于 tailwind CSS + Shadcn UI + React 的前端代码
* **apps/cli** Node.js 代码
* **apps/electron** Electron wrapper, 把 ui 和 cli 打包成 Electron 应用
* **apps/e2e** 基于 webdriver.io 的端到端测试

## 开发原则

### UI 乐观更新策略

为了提供最佳的 UX, 本应用假设后台操作总是会成功. 开发者应该:
1. 先更新UI状态
2. 执行后台操作(异步计算, API 调用, 等待回调等)
3. 如果后台操作失败, 回滚UI状态, 并弹出合适的错误提示