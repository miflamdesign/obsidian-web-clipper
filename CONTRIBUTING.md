# 贡献指南

感谢你帮助改进这个网页资料整理工具。

## 开始前

- 请先确认问题或改进点与网页资料整理、Markdown 归档或 Obsidian 工作流有关。
- 不要提交个人 Vault、浏览器配置、Cookies、API Key、访问令牌或真实网页采集内容。
- 涉及行为变化时，请同时更新 README 和测试。

## 本地检查

```bash
node --test test
node --check tomd.js
node --check tomd.user.js
node --check rawify-common.js
node --check rawify-remote-batch.js
node --check rawify-remote-single.js
```

## 提交变更

请在 Pull Request 中说明：

1. 变更解决了什么问题；
2. 影响了浏览器脚本、QuickAdd 脚本还是图片补全脚本；
3. 如何验证，以及是否需要用户调整 Vault 配置。

保持改动范围清晰，优先使用本地、可复现的测试数据。
