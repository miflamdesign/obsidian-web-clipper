const CLIP_TYPE = "kb-clip-v3";
const SUPPORTED_CLIP_TYPES = new Set(["kb-clip-v2", "kb-clip-v3"]);
const CLIPS_DIR = "raw/clips";
const ASSETS_DIR = "raw/assets";
const MIN_MARKDOWN_LENGTH = 20;

const TRACKING_PARAMETER = /^(utm_|ga_|mc_|fbclid$|gclid$|spm$|from$|source$|ref$|share_token$|isappinstalled$)/i;

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(-8);
}

function sanitizeFilePart(value, maxLength = 80) {
  const cleaned = String(value || "")
    .replace(/[：:]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[\\/]/g, "-")
    .replace(/[<>"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();

  return cleaned || "未命名网页";
}

function normalizeClipUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    if ((url.protocol === "https:" && url.port === "443") ||
        (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
    }

    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";

    const normalized = url.toString();
    return normalized.endsWith("/") && url.pathname === "/"
      ? normalized.slice(0, -1)
      : normalized.replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function normalizeClipData(payload) {
  const text = (value) => (value == null ? "" : String(value).trim());
  return {
    __clip_type: CLIP_TYPE,
    title: text(payload.title) || "未命名网页",
    author: text(payload.author),
    source: text(payload.source) || text(payload.page_url),
    page_url: text(payload.page_url),
    canonical_url: text(payload.canonical_url),
    publish_date: text(payload.publish_date),
    collected_date: text(payload.collected_date) || todayString(),
    markdown: text(payload.markdown),
    source_site: text(payload.source_site),
  };
}

function parseClipboard(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("剪贴板为空，请先在网页端点击采集按钮");

  if (!raw.startsWith("{")) {
    try {
      const legacyUrl = new URL(raw);
      return { mode: "legacy", url: legacyUrl.toString() };
    } catch {
      throw new Error("剪贴板内容不是有效的网页采集数据");
    }
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("剪贴板内容不是有效的 JSON");
  }

  if (!payload || !SUPPORTED_CLIP_TYPES.has(payload.__clip_type)) {
    throw new Error("无法识别剪贴板数据格式");
  }

  const data = normalizeClipData(payload);
  if (data.markdown.length < MIN_MARKDOWN_LENGTH) {
    throw new Error("正文内容过短，未创建笔记");
  }

  return { mode: "clip", data };
}

function parseFrontmatter(content) {
  const match = String(content || "").match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return {};

  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    fields[field[1]] = value;
  }
  return fields;
}

function findDuplicateClip(data, files) {
  const incomingUrls = new Set([
    data.page_url,
    data.canonical_url,
    data.source,
  ].map(normalizeClipUrl).filter(Boolean));

  if (incomingUrls.size === 0) return null;

  for (const file of files) {
    const frontmatter = parseFrontmatter(file.content);
    const existingUrls = [
      frontmatter.page_url,
      frontmatter.canonical_url,
      frontmatter.source,
    ].map(normalizeClipUrl).filter(Boolean);

    if (existingUrls.some((url) => incomingUrls.has(url))) return file;
  }

  return null;
}

function buildClipPath(data, existingPaths) {
  const paths = existingPaths instanceof Set ? existingPaths : new Set(existingPaths || []);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(data.collected_date || "")
    ? data.collected_date
    : todayString();
  const title = sanitizeFilePart(data.title);
  const base = `${CLIPS_DIR}/${date}-${title}.md`;

  if (!paths.has(base)) return base;

  const identity = normalizeClipUrl(data.canonical_url || data.page_url || data.source || data.title);
  const suffix = shortHash(identity || data.title);
  let candidate = `${CLIPS_DIR}/${date}-${title}-${suffix}.md`;
  let counter = 2;

  while (paths.has(candidate)) {
    candidate = `${CLIPS_DIR}/${date}-${title}-${suffix}-${counter}.md`;
    counter += 1;
  }
  return candidate;
}

function yamlString(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

function buildFrontmatter(data, collectedDate = todayString()) {
  const publishDate = /^\d{4}-\d{2}-\d{2}$/.test(data.publish_date || "")
    ? data.publish_date
    : collectedDate;

  return [
    "---",
    `title: ${yamlString(data.title)}`,
    `date: ${publishDate}`,
    `collected: ${data.collected_date || collectedDate}`,
    `source: ${yamlString(data.source)}`,
    `page_url: ${yamlString(data.page_url)}`,
    `canonical_url: ${yamlString(data.canonical_url)}`,
    `author: ${yamlString(data.author)}`,
    "tags:",
    "  - raw",
    "  - clip",
    "---",
    "",
  ].join("\n");
}

function inferExt(url, contentType = "") {
  const lowerUrl = url.toLowerCase();
  const lowerType = contentType.toLowerCase();
  if (lowerUrl.includes(".png") || lowerType.includes("image/png") || lowerUrl.includes("wx_fmt=png")) return "png";
  if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg") || lowerType.includes("image/jpeg") || lowerUrl.includes("wx_fmt=jpg") || lowerUrl.includes("wx_fmt=jpeg")) return "jpg";
  if (lowerUrl.includes(".gif") || lowerType.includes("image/gif") || lowerUrl.includes("wx_fmt=gif")) return "gif";
  if (lowerUrl.includes(".webp") || lowerType.includes("image/webp") || lowerUrl.includes("wx_fmt=webp")) return "webp";
  if (lowerUrl.includes(".svg") || lowerType.includes("image/svg+xml")) return "svg";
  return "jpg";
}

function parseMarkdownImage(line) {
  const match = String(line).match(/!\[([^\]]*)\]\(([^)]+)\)/);
  return match ? { alt: match[1], src: match[2].trim() } : null;
}

async function ensureVaultFolder(app, folderPath) {
  const segments = folderPath.split("/");
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.adapter.mkdir(current);
    }
  }
}

async function downloadImages(app, markdown, notePath, options = {}) {
  const noteName = notePath.split("/").pop() || notePath;
  const imageDir = `${ASSETS_DIR}/${sanitizeFilePart(noteName.replace(/\.md$/, ""))}`;
  await ensureVaultFolder(app, imageDir);

  const request = options.requestUrl || (typeof requestUrl === "function" ? requestUrl : null);
  const referer = options.referer || "https://example.com/";
  const lines = String(markdown).split("\n");
  let imageIndex = 1;
  let saved = 0;
  let failed = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const image = parseMarkdownImage(lines[index]);
    if (!image || !/^https?:\/\//i.test(image.src)) continue;

    if (!request) {
      failed += 1;
      continue;
    }

    try {
      const response = await request({
        url: image.src,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: referer,
        },
      });
      const contentType = response.headers?.["content-type"] || response.headers?.get?.("content-type") || "";
      const fileName = `img-${String(imageIndex).padStart(3, "0")}-${shortHash(image.src)}.${inferExt(image.src, contentType)}`;
      const imagePath = `${imageDir}/${fileName}`;
      await app.vault.adapter.writeBinary(imagePath, response.arrayBuffer);
      lines[index] = lines[index].replace(/!\[[^\]]*\]\([^)]+\)/, `![[${fileName}]]`);
      imageIndex += 1;
      saved += 1;
    } catch (error) {
      failed += 1;
      console.error(`图片下载失败（第 ${index + 1} 行）: ${error.message}`);
    }
  }

  return { markdown: lines.join("\n"), saved, failed };
}

async function readClipboardText() {
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  try {
    const electron = require("electron");
    return electron.clipboard.readText();
  } catch {
    throw new Error("无法读取系统剪贴板，请确认在 Obsidian QuickAdd 中运行此脚本");
  }
}

function showNotice(message, duration) {
  if (typeof Notice === "function") new Notice(message, duration);
}

async function loadClipFiles(app) {
  return Promise.all(
    app.vault.getMarkdownFiles()
      .filter((file) => file.path.startsWith(`${CLIPS_DIR}/`))
      .map(async (file) => ({ path: file.path, content: await app.vault.read(file) }))
  );
}

async function runQuickAdd({ app }) {
  const clipboard = await readClipboardText();
  const parsed = parseClipboard(clipboard);

  if (parsed.mode === "legacy") {
    throw new Error("检测到旧版 URL 输入。请先在网页端运行油猴采集脚本，再打开 QuickAdd");
  }

  const data = parsed.data;
  const files = await loadClipFiles(app);
  const duplicate = findDuplicateClip(data, files);
  const targetPath = duplicate
    ? duplicate.path
    : buildClipPath(data, new Set(files.map((file) => file.path)));

  showNotice("正在整理网页内容…");
  await ensureVaultFolder(app, CLIPS_DIR);
  const processed = await downloadImages(app, data.markdown, targetPath, {
    referer: data.page_url || data.source,
  });
  const content = buildFrontmatter(data) + processed.markdown.trim() + "\n";
  const existing = app.vault.getAbstractFileByPath(targetPath);

  if (existing && typeof app.vault.modify === "function") {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(targetPath, content);
  }

  await app.workspace.openLinkText(targetPath, "", true);
  const action = duplicate ? "已更新已有笔记" : "已创建笔记";
  const imageMessage = processed.failed > 0
    ? `图片本地化 ${processed.saved} 张，${processed.failed} 张保留原链接`
    : `图片本地化 ${processed.saved} 张`;
  showNotice(`${action}：${imageMessage}`, 5000);
}

async function main(params) {
  try {
    await runQuickAdd(params);
  } catch (error) {
    showNotice(error.message || "网页内容整理失败", 6000);
    console.error(error);
  }
}

module.exports = main;
module.exports.parseClipboard = parseClipboard;
module.exports.normalizeClipUrl = normalizeClipUrl;
module.exports.findDuplicateClip = findDuplicateClip;
module.exports.buildClipPath = buildClipPath;
module.exports.buildFrontmatter = buildFrontmatter;
module.exports.downloadImages = downloadImages;
