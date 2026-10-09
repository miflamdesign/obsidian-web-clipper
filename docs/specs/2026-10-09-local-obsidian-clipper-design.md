# 本地 Obsidian 网页采集流程设计

## 目标

把仓库从“QuickAdd 输入 URL 并调用远程转换服务”调整为与当前实际使用方式一致的本地工作流：网页端脚本负责提取内容，QuickAdd 从剪贴板读取结构化数据，Obsidian 在本地完成整理、去重、图片下载和 Markdown 写入。

## 当前流程

```text
网页
  -> 油猴脚本提取正文、标题、作者、来源、日期和图片
  -> 将结构化 JSON 写入系统剪贴板
  -> obsidian://quickadd 调起 QuickAdd
  -> tomd.js 读取剪贴板
  -> raw/clips/ 写入 Markdown
  -> raw/assets/<文章名>/ 保存图片并替换为 Wiki 链接
```

## 数据接口

油猴脚本写入的 JSON 使用 `__clip_type: "kb-clip-v3"` 标识，至少包含：

- `title`: 页面标题
- `author`: 作者，可为空
- `source`: 展示用来源地址
- `page_url`: 当前页面地址
- `canonical_url`: 规范地址，可为空
- `publish_date`: 页面发布日期，可为空
- `collected_date`: 采集日期
- `markdown`: 正文 Markdown
- `source_site`: 来源站点，可为空

QuickAdd 只接受该结构化格式和保留兼容性的旧版 URL 输入；新版主路径不再访问远程 tomd 服务，也不在仓库保存 API Key。

## 文件规则

- 笔记目录：`raw/clips/`
- 图片目录：`raw/assets/<清洗后的笔记文件名>/`
- 文件名使用采集日期和清洗后的标题，标题最长 80 个字符。
- Frontmatter 保留 `title`、`date`、`collected`、`source`、`page_url`、`canonical_url`、`author` 和 `tags`。
- URL 去重时忽略 hash 和常见统计参数；规范化后的 `page_url`、`canonical_url` 任一匹配即视为重复。
- 同标题但不同来源不得覆盖已有笔记；发生路径冲突时追加短哈希。

## 图片处理

- 只下载 Markdown 图片中的 `http`/`https` 地址。
- 图片文件名由顺序、来源地址短哈希和推断扩展名组成。
- 下载成功后替换为 `![[图片文件名]]`；失败时保留原远程地址并在提示中报告。
- QuickAdd 内置下载逻辑与批量脚本使用相同的目录和命名规则。
- 批量脚本通过命令行参数接收 Vault 路径，不绑定某一台机器的绝对路径。

## 文案原则

- 项目定位使用“网页资料整理”“本地 Markdown 归档”“Obsidian 工作流”等表述。
- 不把 AI、模型或自动生成作为项目的核心能力描述。
- 文档说明真实的数据流和依赖，不保留远程服务、API Key、速率限制等已废弃内容。

## 非目标

- 本次不新增服务器、数据库或账号体系。
- 本次不改变用户已有 Vault 中历史文件的位置；批量脚本只按新目录参数运行。
- 本次不自动推送 GitHub，也不修改 Obsidian Vault 的实际文件。
