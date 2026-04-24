const API_KEY = "sk-e338d2452e8b71cc0711304e07bb075b9bc0326661d5b9dd";
const BASE_URL = "https://tomd.ou.al/";

// 清洗图片目录名
function sanitizeDirName(name) {
  return name
    .replace(/\.md$/, "")
    .replace(/[：:]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[\/\\]/g, "-")
    .replace(/[<>"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function md5Hex(str) {
  // Obsidian 环境没有 Node crypto，用简单哈希代替
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function inferExt(url, contentType = "") {
  const u = url.toLowerCase();
  const t = contentType.toLowerCase();
  if (u.includes(".png") || t.includes("image/png")) return "png";
  if (u.includes(".jpg") || u.includes(".jpeg") || t.includes("image/jpeg")) return "jpg";
  if (u.includes(".gif") || t.includes("image/gif")) return "gif";
  if (u.includes(".webp") || t.includes("image/webp")) return "webp";
  if (u.includes(".svg") || t.includes("image/svg+xml")) return "svg";
  if (u.includes("wx_fmt=png")) return "png";
  if (u.includes("wx_fmt=jpeg") || u.includes("wx_fmt=jpg")) return "jpg";
  if (u.includes("wx_fmt=gif")) return "gif";
  if (u.includes("wx_fmt=webp")) return "webp";
  return "jpg";
}

function parseMarkdownImage(line) {
  const start = line.indexOf("](");
  const end = line.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start + 2) return null;
  return line.slice(start + 2, end).trim();
}

async function downloadImages(app, markdown, fileName) {
  const safeDirName = sanitizeDirName(fileName);
  const imageDir = `raw/images/${safeDirName}`;

  // 确保图片目录存在
  const dirExists = await app.vault.adapter.exists(imageDir);
  if (!dirExists) {
    await app.vault.adapter.mkdir(imageDir);
  }

  const lines = markdown.split("\n");
  let imageIndex = 1;
  let changed = false;
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("![") || !line.includes("](")) continue;

    const src = parseMarkdownImage(line);
    if (!src || !(src.startsWith("http://") || src.startsWith("https://"))) continue;

    try {
      const res = await requestUrl({
        url: src,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://mp.weixin.qq.com/",
        },
      });

      const contentType = res.headers["content-type"] || "";
      const ext = inferExt(src, contentType);
      const imgFileName = `img-${String(imageIndex).padStart(3, "0")}-${md5Hex(src)}.${ext}`;
      const imgPath = `${imageDir}/${imgFileName}`;

      // 写入图片文件
      await app.vault.adapter.writeBinary(imgPath, res.arrayBuffer);

      // 替换为 Wiki 链接
      lines[i] = line.replace(/!\[([^\]]*)\]\([^)]+\)/, `![[${imgFileName}]]`);
      imageIndex += 1;
      saved += 1;
      changed = true;
    } catch (err) {
      console.error(`图片下载失败 (第${i+1}行): ${err.message}`);
      failed += 1;
    }
  }

  return {
    markdown: changed ? lines.join("\n") : markdown,
    saved,
    failed,
  };
}

module.exports = async (params) => {
  const { quickAddApi, app } = params;

  const url = await quickAddApi.inputPrompt("输入网页 URL：");
  if (!url) return;

  new Notice("正在获取内容，请稍候...");

  try {
    const response = await requestUrl({
      url: `${BASE_URL}${url}?key=${API_KEY}`,
      method: "GET",
    });

    let markdown = response.text;

    // 解析 frontmatter
    const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    let title = "未知标题";
    let author = "";
    let source = url;

    if (fmMatch) {
      const fm = fmMatch[1];
      const getField = (key) => {
        const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\n]+)"?`, "m"));
        return m ? m[1].trim() : "";
      };
      title  = getField("title") || "未知标题";
      author = getField("author");
      source = getField("source") || url;
      markdown = markdown.replace(/^---\n[\s\S]*?\n---\n/, "").trimStart();
    }

    const today = new Date().toISOString().slice(0, 10);
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 50);
    const fileName = `${today}-${safeTitle}.md`;

    const frontmatter = `---
title: "${title}"
source: "${source}"
author:
  - "${author}"
date: ${today}
tags:
  - raw
  - raw/clipping
processed: "false"
---

`;

    // 下载图片并替换链接
    new Notice("正在下载图片，请稍候...");
    const { markdown: processedMarkdown, saved, failed } = await downloadImages(
      app,
      markdown,
      fileName
    );

    const finalContent = frontmatter + processedMarkdown;
    const filePath = `raw/clippings/${fileName}`;

    await app.vault.create(filePath, finalContent);
    await app.workspace.openLinkText(filePath, "", true);

    const msg = failed > 0
      ? `笔记创建成功！图片 ${saved} 张已保存，${failed} 张失败`
      : `笔记创建成功！${saved} 张图片已本地化`;
    new Notice(msg);

  } catch (e) {
    new Notice("获取失败，请检查 URL 或网络");
    console.error(e);
  }
};