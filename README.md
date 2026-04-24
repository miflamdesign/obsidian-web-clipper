# Obsidian 网页采集工具

将任意网页（微信公众号、人人都是产品经理等）一键转为 Markdown 笔记，并自动将文章图片下载到本地，存入 Obsidian Vault。

---

## 文件说明

```
scripts/
├── tomd.js                   # QuickAdd 采集脚本（主入口）
├── rawify-remote-batch.js    # 批量图片本地化脚本
└── rawify-remote-single.js   # 单文件图片本地化脚本（调试用）
```

---

## 依赖

- [Obsidian](https://obsidian.md/)
- Obsidian 插件：[QuickAdd](https://github.com/chhoumann/quickadd)
- Node.js（运行批量脚本时需要）
- tomd 转换服务：`https://tomd.ou.al`（需要 API Key）

---

## Vault 目录结构

```
Your_Vault/
├── raw/
│   ├── clippings/    # 采集的 Markdown 文章
│   └── images/       # 下载的本地图片（按文章分目录）
└── scripts/
    ├── tomd.js
    ├── rawify-remote-batch.js
    └── rawify-remote-single.js
```

---

## 安装步骤

### 1. 安装 QuickAdd 插件

Obsidian → 设置 → 第三方插件 → 浏览 → 搜索 **QuickAdd** → 安装并启用。

### 2. 创建目录

在 Vault 根目录下手动创建以下文件夹：

```
raw/clippings/
raw/images/
scripts/
```

### 3. 放入脚本文件

将以下三个文件放入 `scripts/` 目录：

- `tomd.js`
- `rawify-remote-batch.js`
- `rawify-remote-single.js`

### 4. 填入 API Key

打开 `tomd.js`，第一行替换为你的 API Key：

```js
const API_KEY = "sk-你的key";
```

### 5. 配置 QuickAdd

1. 打开 Obsidian → 设置 → QuickAdd
2. 输入名称 `网页转Markdown`，类型选 **Macro**，点击 **Add Choice**
3. 点击新建项右侧的齿轮 ⚙️，进入配置
4. 点击 **Add Macro** → **User Script**，选择 `scripts/tomd.js`
5. 回到主列表，点击该项右侧的闪电图标 ⚡️ 激活

### 6. 配置 Obsidian 链接设置

设置 → 文件与链接：

- **使用 Wiki 链接**：开启
- **内部链接类型**：尽可能简短的形式

---

## 日常使用

### 采集文章

1. 复制目标网页的 URL
2. 按 `Cmd+P`（Mac）/ `Ctrl+P`（Windows）打开命令面板
3. 搜索 `网页转Markdown`，回车
4. 粘贴 URL，回车
5. 等待两条提示：「正在获取内容」→「正在下载图片」
6. 笔记自动创建并打开，图片已本地化

生成的笔记格式：

```
raw/clippings/2026-04-24-文章标题.md
raw/images/2026-04-24-文章标题/img-001-xxxxxxxx.png
```

### 批量处理历史文章图片

如果有历史文章图片还是远程链接，在终端运行：

```bash
cd /path/to/your/vault/scripts
node rawify-remote-batch.js
```

脚本会自动遍历 `raw/clippings/` 下所有 md 文件，跳过已处理的，只处理有远程图片的文件。

### 处理单篇文章（调试用）

打开 `rawify-remote-single.js`，修改第 6 行的文件名：

```js
const FILE_NAME = "2026-04-24-你的文章标题.md";
```

然后运行：

```bash
node rawify-remote-single.js
```

---

## 注意事项

**API 速率限制**

tomd 服务每分钟最多 100 次请求。图片较多的文章（20 张以上）可能触发限制，失败的图片会保留原始远程链接，重新跑批量脚本即可补全。

**公众号图片防盗链**

部分微信公众号图片有时效性，链接过期后无法下载。建议采集后尽快运行图片本地化，或直接用 `tomd.js` 采集时自动处理。

**文件名特殊字符**

脚本会自动清洗标题中的冒号、破折号等特殊字符，避免 Obsidian 路径解析问题。无需手动处理。

---

## 速率限制说明

tomd 服务由私人搭建，当前 API Key 限制：

- 每分钟：100 次请求
- 超出后需等待下一分钟重试

如需更高配额，联系服务提供方。

---

## 常见问题

**图片显示「找不到」？**

检查 Obsidian 设置 → 文件与链接 → 确认「使用 Wiki 链接」已开启。

**采集失败，提示「获取失败」？**

- 确认 URL 完整（包含 `https://`）
- 确认网络可以访问 `tomd.ou.al`
- 部分网站有反爬限制，tomd 服务可能无法解析

**批量脚本跑完有失败的图片？**

正常现象，通常是网络超时。重新运行 `rawify-remote-batch.js` 即可，已下载的图片不会重复处理。
