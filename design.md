# 改进 LocalFileTableRow 以显示关联文件和正在运行的任务

**关联文件 (Associated Files)** 是指与视频音频文件 (Video/Audio File) 相关的文件，例如字幕文件 (Subtitle File)、音频文件 (Audio File)、封面图片 (Poster Image) 等。

## 新增/改动组件

1. 创建 LocalFileRow
LocalFileTableRow 现在包含 "#", "封面", "标题", "艺术家", "时长" 列
把这5列抽取成 LocalFileRow 组件
并新增一列用于"展开"按钮图标
注意: 展开/收缩按钮使用图标按钮, 而不是文字

2. 创建 AssociatedFileRow 
AssociatedFileRow 用于表示关联文件
AssociatedFileRow 包含 "空白"列, "文件类型"列, 和"文件名"列
空白列与"#"列对齐, "文件类型"列与封面列对齐, 文件名列与标题, 艺术家， 时长列对齐

3. 创建 EmptyAssociatedFileRow
用于表示"没有找到任何字幕、封面、音频等关联文件"

4. 创建 JobRow
用于表示针对LocalFileTableRow对应的本地视频/音频文件的"生成字幕", "翻译字幕", "合成字幕", "处理字幕"任务
JobRow只需要用于表示任务运行的文字消息, 例如 "生成字幕中...".
JobRow 底层使用 AnimatedDotsText 组件


## 组件布局

使用 CSS Grid 布局实现 LocalFileTableRow
并为 local-file-row 和 associated-file-row 定义不同的 columns template

使用 subgrid 包裹多个 AssociatedFileRow, 以方便实现展开收缩功能


LocalFileTableRow 有3种场景

### 场景1: 有关联文件

#### 展开
```
LocalFileTableRow
    |-- LocalFileRow: "#", "封面", "标题", "艺术家", "时长", "收缩"
    |-- AssociatedFileRow: "(空白)", "字幕", "文件名.srt"
    |-- AssociatedFileRow: "(空白)", "字幕", "文件名.en-US.srt"
    |-- ...
    |-- AssociatedFileRow: "(空白)", "封面", "文件名.jpg"
```

#### 收缩
```
LocalFileTableRow
    |-- LocalFileRow: "#", "封面", "标题", "艺术家", "时长", "展开"
```

### 场景2: 无关联文件

```
LocalFileTableRow
    |-- LocalFileRow: "#", "封面", "标题", "艺术家", "时长", "展开/收缩"
    |-- AssociatedFileRow: "(空白)", "没有找到任何字幕、封面、音频等关联文件"
```

### 场景3: 字幕任务进行中

```
LocalFileTableRow
    |-- LocalFileRow: "#", "封面", "标题", "艺术家", "时长", "展开/收缩"
    |-- AssociatedFileRow: "(空白)", "封面", "文件名.jpg"
    |-- JobRow: 使用 AnimatedDotsText 组件, 文字为"正在生成字幕..."
```

这个场景下, 可能不存在任何关联文件, 即不存在AssociatedFileRow
也可能已经存在多个关联文件, 即多个 AssociatedFileRow
需要保证 JobRow 在最底部

## 数据结构

```typescript

interface AssociatedFile {
  type: "subtitle" | "audio" | "thumbnail" | "summary"
  path: string // absolute path
}

interface RunningJob {
    type: "transcribing" | "translating" | "synthesising" | "processing" | 
}

```

创建 `useGetAssociatedFilesMutation` , 用于获取关联文件列表
LocalFileTableRow 使用 `useGetAssociatedFilesMutation` 获取关联文件列表

useGetAssociatedFilesMutation 的逻辑大概如下:
1. 使用 listFiles API 获取所有文件
2. 根据文件名筛选出关联文件
3. 返回关联文件列表

由于每个 LocalFileTableRow 单独调用 useGetAssociatedFilesMutation
listFiles API 会被多次调用
使用 TanStack Query 包装 listFiles API, 并缓存结果
这能有效避免 listFiles API 被多次调用

## 查询 Running Job
使用 backgroundJobStore 查询与 LocalFileTableRow 文件相关的, 正在运行的 job

需要查询现有代码, Background Job 的数据是否有字段可以关联 LocalFileTableRow
如果没有, 需要修改现有的创建 job 的流程, 以保存文件的 path(绝对路径)