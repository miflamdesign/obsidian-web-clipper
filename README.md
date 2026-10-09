# Obsidian 网页资料整理工具

把网页正文整理成 Markdown，通过剪贴板交给 Obsidian QuickAdd，在本地完成笔记归档和图片保存。适合微信公众号、产品文章、技术文档等需要长期留存的网页资料。

浏览器端负责提取页面，Obsidian 负责写入 Vault，历史图片可以用 Node.js 脚本补全；内容处理和文件保存都在本地完成。

## 工作流程

```text
网页
  -> 油猴脚本提取正文和元数据
  -> 结构化 JSON 写入剪贴板
  -> obsidian://quickadd 调起 QuickAdd
  -> tomd.js 读取剪贴板并整理笔记
  -> raw/clips/ 保存 Markdown
  -> raw/assets/ 保存本地图片
```

## 文件说明

```text
tomd.user.js              # 浏览器端油猴脚本
tomd.js                   # Obsidian QuickAdd User Script
rawify-common.js          # 图片补全的公共逻辑
rawify-remote-batch.js    # 批量图片补全
rawify-remote-single.js   # 单篇图片补全
test/                     # 本地检查用例
```

## 依赖

- [Obsidian](https://obsidian.md/)
- Obsidian 社区插件 [QuickAdd](https://github.com/chhoumann/quickadd)
- 支持脚本安装的浏览器扩展（如 Tampermonkey）
- Node.js 18 或更高版本（只在运行图片补全脚本时需要）

## 安装

### 1. 准备 Vault 目录

在 Vault 根目录创建以下目录，并将脚本复制到 `scripts/`：

```text
Your_Vault/
├── raw/
│   ├── clips/                 # 网页 Markdown 笔记
│   └── assets/                # 按笔记分目录保存的图片
├── scripts/
│   ├── tomd.js
│   ├── tomd.user.js
│   ├── rawify-common.js
│   ├── rawify-remote-batch.js
│   └── rawify-remote-single.js
└── .obsidian/
```

### 2. 安装油猴脚本

在 Tampermonkey 中新建脚本，将 `tomd.user.js` 的内容粘贴进去并保存。

如果 Vault 名称或 QuickAdd 选项名称不同，修改脚本顶部的：

```js
const OBSIDIAN_URI = "obsidian://quickadd?vault=你的Vault名称&choice=tomd";
```

### 3. 配置 QuickAdd

1. 在 Obsidian 中安装并启用 QuickAdd。
2. 新建一个 Macro，名称建议使用 `tomd`。
3. 在 Macro 中添加 User Script，选择 Vault 内的 `scripts/tomd.js`。
4. 启用该 Macro。
5. 在 Obsidian 的“文件与链接”设置中开启“使用 Wiki 链接”。

## 日常使用

1. 打开需要保存的网页。
2. 点击页面右侧的紫色 `📥` 按钮。
3. 脚本会提取标题、作者、来源、日期、正文和图片地址，并将数据写入剪贴板。
4. 浏览器会打开 Obsidian QuickAdd。
5. QuickAdd 读取剪贴板，在 `raw/clips/` 创建笔记，并把图片保存到 `raw/assets/`。

生成的文件示例：

```text
raw/clips/2026-10-09-网页标题.md
raw/assets/2026-10-09-网页标题/img-001-a1b2c3d4.png
```

重复采集同一页面时，会根据 `page_url`、`canonical_url` 和 `source` 去重并更新原笔记。同标题但来源不同的页面会追加短哈希，不会覆盖已有笔记。

## 补全历史图片

批量处理 Vault 中仍然使用远程图片地址的笔记：

```bash
node rawify-remote-batch.js /path/to/your/vault
```

只处理一篇笔记：

```bash
node rawify-remote-single.js /path/to/your/vault 2026-10-09-网页标题.md
```

下载失败的图片会保留原地址，再次运行脚本即可重试；已经保存的文件不会重复下载。

## 剪贴板数据

浏览器端写入的 JSON 使用 `__clip_type: "kb-clip-v3"` 标识，包含以下字段：

```json
{
  "__clip_type": "kb-clip-v3",
  "title": "网页标题",
  "author": "作者",
  "source": "https://example.com/article",
  "page_url": "https://example.com/article",
  "canonical_url": "https://example.com/article",
  "publish_date": "2026-10-08",
  "collected_date": "2026-10-09",
  "markdown": "正文内容",
  "source_site": "example.com"
}
```

## 常见问题

**点击按钮后没有打开 Obsidian？**

检查浏览器是否允许打开 `obsidian://` 链接，并确认 Vault 名称和 QuickAdd 选项名称与脚本中的配置一致。

**笔记创建了，但某些图片仍是远程地址？**

图片可能有防盗链、临时地址或网络超时。先确认地址仍然有效，再运行批量补全脚本。

**出现“剪贴板内容不是有效的 JSON”？**

先回到网页点击油猴脚本按钮，再运行 QuickAdd。旧版只复制 URL 的用法不再作为主流程。

## 本地检查

```bash
node --test test
node --check tomd.js
node --check tomd.user.js
node --check rawify-common.js
node --check rawify-remote-batch.js
node --check rawify-remote-single.js
```

## 参与贡献

欢迎围绕网页正文提取、Obsidian 兼容性和本地图片整理提交改进。提交前请运行上面的本地检查，并确认示例中没有真实网址、个人 Vault 路径或访问凭据。

详细流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目采用 MIT License，详见 [LICENSE](LICENSE)。

## 说明

文章内容和图片的版权、访问权限及保存范围由使用者自行确认。仓库只提供本地整理和归档脚本，不上传 Vault 内容，也不包含个人 Vault 配置。
