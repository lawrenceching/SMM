# Download Video Core Data Flow

## 目标

本文只描述当前实现中的**核心数据流动**，帮助快速理解下载视频相关模块如何协作。  
不展开具体代码实现细节。

---

## 核心参与者

- `DownloadVideoDialog`
- `MusicPanel`
- `Service Worker`（`download-video-sw.js`）
- `Ytdlp API`（`/api/ytdlp/*`）
- `backgroundJobsStore`（下载任务状态源）
- `downloadVideoJobRunner`（页面侧编排与消息桥接）
- `DownloadVideoServiceWorkerInitializer`（注册与订阅入口）
- `DialogProvider`（打开下载对话框的入口）

---

## 总体数据流（高层）

1. 用户在 `MusicPanel` 或菜单触发“下载视频”，通过 `DialogProvider` 打开 `DownloadVideoDialog`。
2. `DownloadVideoDialog` 收集输入（URL、目标目录、是否播放列表），在页面侧准备下载项数据。
3. `DownloadVideoDialog` 创建 `download-video` 类型任务写入 `backgroundJobsStore`，然后交给 `downloadVideoJobRunner` 启动。
4. `downloadVideoJobRunner` 优先通过 `Service Worker` 启动后台编排；不可用时使用页面内 fallback 继续执行。
5. `Service Worker`（或 fallback）逐项调用 `Ytdlp API` 执行下载。
6. 下载进度与结果以消息形式回传页面，页面将消息转换为任务状态更新并写回 `backgroundJobsStore`。
7. `MusicPanel` 从 `backgroundJobsStore` 按目录筛选 `download-video` 任务并映射为临时 Track，和本地媒体文件一起展示。
8. 下载完成后触发对应目录元数据刷新，本地持久 Track 替换临时下载行。

---

## 组件视角的数据职责

## `DownloadVideoDialog`

- 输入源：用户输入的 URL、目录、播放列表选择。
- 输出：
  - 任务创建输入（任务名、目录、URL 列表、初始 item 状态）。
  - 启动任务命令（交给 runner）。
- 不负责：
  - 持续下载执行。
  - 直接驱动 `MusicPanel` 临时 UI。

## `backgroundJobsStore`

- 角色：下载任务唯一状态源。
- 持有数据：
  - 任务级状态（pending/running/succeeded/failed...）。
  - 下载项级状态（pending/downloading/completed/failed）。
  - 目录、URL、结果路径等下载上下文。
- 被谁写：`DownloadVideoDialog`（创建）、runner 消息处理（更新）。
- 被谁读：`MusicPanel`、后台任务相关 UI。

## `downloadVideoJobRunner`

- 角色：页面侧编排入口。
- 主要职责：
  - 注册/确认 Service Worker 可用性。
  - 启动任务（发消息给 SW 或 fallback）。
  - 接收下载消息并更新 `backgroundJobsStore`。
  - 在“单项完成”后发出目录刷新信号。

## `Service Worker`

- 角色：后台编排器。
- 输入：`download-video/run` 任务启动消息（jobId、folder、urls、args）。
- 行为：按顺序处理 URL 列表，逐项调用 `Ytdlp API`。
- 输出：
  - 进度消息（当前索引进入 downloading）。
  - 单项完成消息（completed/failed + path/error）。
  - 任务完成消息。

## `Ytdlp API`

- 角色：下载执行端接口（实际落盘在 CLI 侧）。
- 被调用方：
  - `Service Worker`（主路径）
  - 页面 fallback（SW 不可用时）
- 返回：每项下载结果（成功/失败、路径、错误信息）。

## `MusicPanel`

- 输入：
  - 本地媒体元数据（永久 Track）。
  - `backgroundJobsStore` 中当前目录的下载任务（临时 Track）。
- 处理：
  - 将任务映射为临时 Track（pending/downloading/completed/failed）。
  - 与本地 Track 合并展示。
  - 监听目录刷新信号并重新拉取媒体元数据。
- 输出：用户可见的统一播放列表视图。

---

## 关键数据对象（概念）

- **Download Job**
  - 任务级字段：`id/name/status/progress/type`
  - 下载上下文：`folder/urls/currentIndex/items/...`
- **Download Item**
  - `url/title/artist/path/status/error`
- **SW Message**
  - `progress`：某项进入下载中
  - `item-done`：某项完成或失败
  - `job-done`：任务结束
- **UI Track**
  - 永久 Track：来自本地媒体库
  - 临时 Track：来自下载任务映射

---

## 关键链路（按时间）

1. `openDownloadVideo` -> `DownloadVideoDialog`
2. `DownloadVideoDialog` -> `backgroundJobsStore.createDownloadVideoJob`
3. `DownloadVideoDialog` -> `downloadVideoJobRunner.startDownloadVideoJob`
4. runner -> `Service Worker`（或 fallback）
5. SW/fallback -> `Ytdlp API`
6. SW/fallback -> runner message handler
7. message handler -> `backgroundJobsStore.patchDownloadVideoJob`
8. `MusicPanel` 订阅任务变化并更新临时 Track
9. 下载完成触发目录刷新 -> 本地媒体元数据更新 -> 临时 Track 被永久 Track 替换

---

## 当前架构要点（一句话）

下载系统是“**Dialog 创建任务 + Runner/SW 编排执行 + Store 统一持久状态 + MusicPanel 投影展示**”的事件驱动数据流。

