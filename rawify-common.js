const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function sanitizeDirName(name) {
  return String(name || "")
    .replace(/\.md$/, "")
    .replace(/[：:]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[\\/]/g, "-")
    .replace(/[<>"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "未命名网页";
}

function shortHash(value) {
  return crypto.createHash("md5").update(value).digest("hex").slice(0, 8);
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
  return match ? { src: match[2].trim() } : null;
}

async function saveRemoteImage(url, imageDir, index) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://mp.weixin.qq.com/",
    },
  });

  if (!response.ok) throw new Error(`下载失败: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const fileName = `img-${String(index).padStart(3, "0")}-${shortHash(url)}.${inferExt(url, contentType)}`;
  const fullPath = path.join(imageDir, fileName);

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("图片内容为空");
    fs.writeFileSync(fullPath, buffer);
  }

  return fileName;
}

async function processFile(mdPath, assetsRoot) {
  const content = fs.readFileSync(mdPath, "utf8");
  const lines = content.split("\n");
  const remoteLines = lines
    .map((line, index) => ({ image: parseMarkdownImage(line), index }))
    .filter(({ image }) => image && /^https?:\/\//i.test(image.src));

  if (!remoteLines.length) return { skipped: true, saved: 0, failed: 0 };

  const imageDir = path.join(assetsRoot, sanitizeDirName(path.basename(mdPath)));
  fs.mkdirSync(imageDir, { recursive: true });

  let saved = 0;
  let failed = 0;
  for (const { image, index } of remoteLines) {
    try {
      const fileName = await saveRemoteImage(image.src, imageDir, saved + 1);
      lines[index] = lines[index].replace(/!\[[^\]]*\]\([^)]+\)/, `![[${fileName}]]`);
      saved += 1;
    } catch (error) {
      failed += 1;
      console.error(`  ✗ 第 ${index + 1} 行失败: ${error.message}`);
    }
  }

  if (saved > 0) fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  return { skipped: false, saved, failed };
}

function getVaultPaths(vaultRoot, clipsDirName = "raw/clips", assetsDirName = "raw/assets") {
  return {
    clipsDir: path.join(vaultRoot, clipsDirName),
    assetsDir: path.join(vaultRoot, assetsDirName),
  };
}

async function processClippingFiles(vaultRoot, clipsDirName, assetsDirName) {
  const { clipsDir, assetsDir } = getVaultPaths(vaultRoot, clipsDirName, assetsDirName);
  if (!fs.existsSync(clipsDir)) throw new Error(`找不到目录: ${clipsDir}`);
  fs.mkdirSync(assetsDir, { recursive: true });

  const files = fs.readdirSync(clipsDir).filter((file) => file.endsWith(".md"));
  let saved = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    process.stdout.write(`处理: ${file}\n`);
    const result = await processFile(path.join(clipsDir, file), assetsDir);
    if (result.skipped) skipped += 1;
    saved += result.saved;
    failed += result.failed;
  }

  return { files: files.length, saved, failed, skipped };
}

module.exports = {
  getVaultPaths,
  processClippingFiles,
  processFile,
};
