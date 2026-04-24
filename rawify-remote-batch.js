const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VAULT_ROOT = "/Users/louiswill/Documents/Louis_OB_Base";
const CLIPPINGS_DIR = path.join(VAULT_ROOT, "raw/clippings");
const IMAGES_ROOT = path.join(VAULT_ROOT, "raw/images");

// 清洗目录名：去掉 Obsidian/文件系统不友好的字符
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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function md5(input) {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 8);
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

async function saveRemoteImage(url, imageDir, index) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://mp.weixin.qq.com/",
    },
  });

  if (!res.ok) {
    throw new Error(`下载失败: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const ext = inferExt(url, contentType);
  const filename = `img-${String(index).padStart(3, "0")}-${md5(url)}.${ext}`;
  const fullPath = path.join(imageDir, filename);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
    return filename; // 已存在，直接返回文件名
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer || buffer.length === 0) {
    throw new Error(`图片内容为空`);
  }

  fs.writeFileSync(fullPath, buffer);
  return filename;
}

async function processFile(mdPath) {
  const fileName = path.basename(mdPath);
  const content = fs.readFileSync(mdPath, "utf8");

  // 跳过没有远程图片的文件
  if (!content.includes("http://") && !content.includes("https://")) {
    return { skipped: true };
  }

  const lines = content.split("\n");
  const hasRemote = lines.some((line) => {
    if (!line.includes("![") || !line.includes("](")) return false;
    const src = parseMarkdownImage(line);
    return src && (src.startsWith("http://") || src.startsWith("https://"));
  });

  if (!hasRemote) {
    return { skipped: true };
  }

  const safeDirName = sanitizeDirName(fileName);
  const imageDir = path.join(IMAGES_ROOT, safeDirName);
  ensureDir(imageDir);

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
      const filename = await saveRemoteImage(src, imageDir, imageIndex);
      // 替换为 Obsidian Wiki 链接格式
      lines[i] = line.replace(/!\[([^\]]*)\]\([^)]+\)/, `![[${filename}]]`);
      imageIndex += 1;
      saved += 1;
      changed = true;
    } catch (err) {
      console.error(`  ✗ 第 ${i + 1} 行失败: ${err.message}`);
      failed += 1;
    }
  }

  if (changed) {
    fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  }

  return { skipped: false, saved, failed };
}

async function main() {
  const files = fs.readdirSync(CLIPPINGS_DIR).filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.log("没有找到 md 文件");
    return;
  }

  console.log(`共找到 ${files.length} 个文件，开始处理...\n`);

  let totalSaved = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const mdPath = path.join(CLIPPINGS_DIR, file);
    process.stdout.write(`处理: ${file}\n`);

    try {
      const result = await processFile(mdPath);
      if (result.skipped) {
        console.log(`  → 跳过（无远程图片）`);
        totalSkipped += 1;
      } else {
        console.log(`  → 保存 ${result.saved} 张，失败 ${result.failed} 张`);
        totalSaved += result.saved;
        totalFailed += result.failed;
      }
    } catch (err) {
      console.error(`  ✗ 文件处理失败: ${err.message}`);
    }
  }

  console.log(`
=============================
✅ 批量处理完成
文件总数: ${files.length}
跳过: ${totalSkipped}
图片保存: ${totalSaved} 张
图片失败: ${totalFailed} 张
=============================`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
