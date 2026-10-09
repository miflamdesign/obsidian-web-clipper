# 本地 Obsidian 网页采集流程 Implementation Plan

本文档按任务清单记录实现步骤，步骤使用复选框（`- [ ]`）跟踪完成情况。

**Goal:** 将仓库更新为“网页端提取内容、剪贴板传递、QuickAdd 本地归档”的 Obsidian 网页采集工具，并同步降低文档中的 AI 表述。

**Architecture:** `tomd.user.js` 负责浏览器侧正文提取和结构化剪贴板协议；`tomd.js` 负责 Obsidian 内的解析、去重、图片本地化和写入；Node 批处理脚本复用相同的图片目录约定。README 只描述本地工作流，不依赖远程转换服务。

**Tech Stack:** Tampermonkey userscript, Obsidian QuickAdd User Script, Node.js built-in test runner, Node.js `fetch`/filesystem APIs.

**Spec:** `docs/specs/2026-10-09-local-obsidian-clipper-design.md`

## Global Constraints

- QuickAdd 主路径必须接受 `kb-clip-v3` JSON，并且不得包含远程 API Key。
- 笔记目录固定为 `raw/clips/`，图片目录固定为 `raw/assets/<清洗后的笔记文件名>/`。
- 同标题不同来源不得覆盖已有笔记。
- 批量脚本不得绑定用户机器的绝对 Vault 路径。
- 项目文案使用网页资料整理、本地 Markdown 归档和 Obsidian 工作流等表述，避免把 AI 作为核心能力。

## Review Focus

- 剪贴板为空、JSON 损坏或正文过短时应给出明确提示且不创建文件；由 Task 1 的解析测试覆盖。
- 同标题但不同来源时不得修改已有笔记；由 Task 1 的路径决策测试覆盖。
- URL 含 hash、追踪参数和微信公众号参数时应稳定去重；由 Task 1 的 URL 测试覆盖。
- 图片下载失败时应保留原链接并继续处理其他图片；由 Task 2 的图片处理测试覆盖。
- 批量脚本从命令行接收 Vault 路径，缺少参数时应给出用法说明；由 Task 3 的 CLI 测试覆盖。

### Task 1: QuickAdd 本地剪贴板入口

**Files:**
- Modify: `tomd.js`
- Create: `test/tomd.test.js`

**Interfaces:**
- Produces: `parseClipboard(text)`, `normalizeClipUrl(url)`, `buildClipPath(data, existingPaths)`, `buildFrontmatter(data, today)` and the QuickAdd default export.

- [x] **Step 1: Write failing tests** for valid `kb-clip-v3`, malformed/short input, URL normalization, duplicate URL matching, and same-title path conflicts.
- [x] **Step 2: Run `node --test test/tomd.test.js` and verify the new tests fail because the interfaces are not implemented.**
- [x] **Step 3: Rewrite `tomd.js`** to read the system clipboard, validate the JSON contract, normalize URLs, scan `raw/clips/` frontmatter, resolve safe paths, download images into `raw/assets/`, and create/update only the matched duplicate.
- [x] **Step 4: Run `node --test test/tomd.test.js` and verify all tests pass.**
- [x] **Step 5: Run `node --check tomd.js`.**

### Task 2: Browser-side collector

**Files:**
- Create: `tomd.user.js`
- Create: `test/tomd-user.test.js`

**Interfaces:**
- Produces: a Tampermonkey script emitting the `kb-clip-v3` clipboard payload and opening the configured QuickAdd URI.

- [x] **Step 1: Write failing static-contract tests** for the metadata fields, Readability/Turndown dependencies, clipboard write, and QuickAdd URI.
- [x] **Step 2: Run `node --test test/tomd-user.test.js` and verify failure because the script does not exist.**
- [x] **Step 3: Implement `tomd.user.js`** with article extraction, metadata fallback, image source normalization, draggable collection button, and error feedback.
- [x] **Step 4: Run the static-contract tests and `node --check tomd.user.js`.**

### Task 3: Portable image backfill scripts

**Files:**
- Modify: `rawify-remote-batch.js`
- Modify: `rawify-remote-single.js`
- Create: `test/rawify-cli.test.js`

**Interfaces:**
- Produces: command-line scripts accepting a Vault path and using `raw/clips/` plus `raw/assets/`.

- [x] **Step 1: Write failing CLI tests** for missing-path usage and new directory names.
- [x] **Step 2: Run `node --test test/rawify-cli.test.js` and verify failure against the hard-coded legacy paths.**
- [x] **Step 3: Update both scripts** to use command-line arguments, the new directories, and consistent Wiki-link replacement.
- [x] **Step 4: Run the CLI tests and `node --check` for both scripts.**

### Task 4: Project documentation and repository hygiene

**Files:**
- Modify: `README.md`
- Create: `.gitignore`

- [x] **Step 1: Add a documentation contract test** checking that README describes the local clipboard flow and contains no remote API-key setup instructions.
- [x] **Step 2: Run the test and verify it fails against the old README.**
- [x] **Step 3: Rewrite README** with installation, QuickAdd configuration, userscript installation, directory layout, daily usage, backfill usage, limitations, and troubleshooting; add ignores for local secrets and runtime files.
- [x] **Step 4: Run the documentation test and the full `node --test` suite.**
