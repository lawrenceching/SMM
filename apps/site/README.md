# SMM 官方网站

Simple Media Manager 的官方网站，纯静态 HTML / CSS / JS，无构建步骤，托管在 GitHub Pages。

访问地址：<https://lawrenceching.github.io/SMM/>

## 目录结构

```text
apps/site/
├─ index.html                 # 根入口：根据浏览器语言跳转 /zh/ 或 /en/
├─ 404.html                   # 自定义 404 页（双语）
├─ robots.txt                 # 搜索引擎策略
├─ sitemap.xml                # 站点地图
├─ .nojekyll                  # 关闭 Jekyll 处理
├─ README.md                  # 本说明
├─ assets/
│  ├─ css/
│  │  ├─ main.css             # 全站基础变量、排版、导航、页脚
│  │  ├─ home.css             # 首页 hero / 功能卡片 / 截图区
│  │  └─ docs.css             # 文档页两栏布局
│  ├─ js/
│  │  ├─ main.js              # 顶部导航、外链补全 rel、年份占位
│  │  └─ docs.js              # 侧栏当前文章高亮 + 移动端折叠
│  └─ img/
│     ├─ favicon.svg
│     ├─ logo.svg
│     └─ screenshot.png       # 复制自仓库根目录
├─ en/                        # 英文站点
│  ├─ index.html
│  └─ docs/
│     ├─ index.html
│     └─ video-captioner-macos.html
└─ zh/                        # 中文站点
   ├─ index.html
   └─ docs/
      ├─ index.html
      └─ video-captioner-macos.html
```

所有内部链接都使用**相对路径**，因此可在以下三种场景正常工作：

- GitHub Pages 项目站点：`https://<user>.github.io/SMM/`
- 自定义域名：`https://example.com/`
- 本地文件直接打开（双击 HTML）或本地 HTTP server

## 本地预览

任意一个静态文件服务器都可以，推荐：

```bash
# 方案 A：Python 自带 http.server
cd apps/site
python -m http.server 5173
# 然后访问 http://localhost:5173/

# 方案 B：Node 自带 npx
cd apps/site
npx http-server -p 5173 .

# 方案 C：bun
cd apps/site
bunx serve .
```

> 双击直接打开 HTML 也可，但 `assets` 路径需要保持相对，避免 `file://` 下出错。

## 新增一篇文档

1. 在 `en/docs/` 复制一份现有文章作为模板，例如：

   ```bash
   cp en/docs/video-captioner-macos.html en/docs/<new-slug>.html
   cp zh/docs/video-captioner-macos.html zh/docs/<new-slug>.html
   ```

2. 修改 `<title>`、`<meta description>`、`<canonical>`、`<link rel="alternate">`，以及正文。
3. 在两份语言版本的侧栏 `<aside class="docs-sidebar">` 内的 `<nav>` 列表里追加：

   ```html
   <a href="./<new-slug>.html">文章标题 / Article title</a>
   ```

4. 在 `sitemap.xml` 中追加两条 `<url>`（中英各一）。
5. 提交到 `main` 分支后，GitHub Actions 会自动重新发布。

## 添加一种新语言

复制 `en/`（或 `zh/`）整目录为 `<lang>/`，逐文件替换内容并更新所有 `<link rel="alternate">` 与语言切换器中的链接。

## GitHub Pages 部署

仓库已经包含 [`/.github/workflows/deploy-site.yml`](../../.github/workflows/deploy-site.yml)。
首次启用步骤：

1. 进入 GitHub 仓库 **Settings → Pages**。
2. **Source** 选择 **GitHub Actions**。
3. 推一次包含 `apps/site/**` 改动的提交，或在 Actions 里手动 `Run workflow`。
4. 部署完成后访问 <https://lawrenceching.github.io/SMM/>。

之后每次 `apps/site/**` 或该 workflow 变更时，都会自动重新部署。

### 自定义域名（可选）

1. 在 `apps/site/` 下新增一个 `CNAME` 文件，内容为你的域名（单行），例如：

   ```text
   smm.example.com
   ```

2. 在 DNS 上为该域名创建 `CNAME` 记录，指向 `lawrenceching.github.io`。
3. 在仓库 **Settings → Pages → Custom domain** 填入域名并启用 **Enforce HTTPS**。

## 设计规范

- 颜色、字体、圆角、阴影等通过 CSS 变量集中在 [`assets/css/main.css`](./assets/css/main.css) 顶部。
- 自动支持深色模式（基于 `prefers-color-scheme`），无需 JS 切换。
- 不引入任何 npm/CDN 依赖，所有图标使用内联 SVG。
