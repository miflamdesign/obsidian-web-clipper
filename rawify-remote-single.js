const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VAULT_ROOT = "/Users/louiswill/Documents/Louis_OB_Base";
const FILE_NAME = "2026-04-23-当大模型厂商发力Coding，Cursor类产品的生死突围 – 人人都是产品经理.md"; // ← 每次改这里

// 清洗目录名：去掉 Obsidian/文件系统不友好的字符
function sanitizeDirName(name) {
  return name
    .replace(/\.md$/, "")          // 去掉 .md 后缀
    .replace(/[：:]/g, "-")         // 全角/半角冒号 → -
    .replace(/[–—]/g, "-")         // 长破折号 → -
    .replace(/[\/\\]/g, "-")       // 斜杠 → -
    .replace(/[<>"|?*]/g, "")      // 其他非法字符直接删掉
    .replace(/\s+/g, " ")          // 多个空格合并
    .trim();
}

const SAFE_DIR_NAME = sanitizeDirName(FILE_NAME);
const CLIPPING_PATH = path.join(VAULT_ROOT, "raw/clippings", FILE_NAME);
const IMAGE_DIR = path.join(VAULT_ROOT, "raw/images", SAFE_DIR_NAME);

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

async function saveRemoteImage(url, index) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://mp.weixin.qq.com/",
    },
  });

  if (!res.ok) {
    throw new Error(`下载失败: ${res.status} ${url}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const ext = inferExt(url, contentType);
  const filename = `img-${String(index).padStart(3, "0")}-${md5(url)}.${ext}`;
  const fullPath = path.join(IMAGE_DIR, filename);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
    return fullPath;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer || buffer.length === 0) {
    throw new Error(`图片内容为空: ${url}`);
  }

  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

async function main() {
  console.log(`图片目录名: ${SAFE_DIR_NAME}`);

  ensureDir(IMAGE_DIR);

  const content = fs.readFileSync(CLIPPING_PATH, "utf8");
  const lines = content.split("\n");

  let imageIndex = 1;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("![") || !line.includes("](")) continue;

    const src = parseMarkdownImage(line);
    if (!src || !(src.startsWith("http://") || src.startsWith("https://"))) continue;

    try {
      const savedPath = await saveRemoteImage(src, imageIndex);
      const relativePath = path
        .relative(path.dirname(CLIPPING_PATH), savedPath)
        .replace(/\\/g, "/");

      lines[i] = line.replace(src, relativePath);
      console.log(`已保存: ${path.basename(savedPath)}`);
      imageIndex += 1;
      changed = true;
    } catch (err) {
      console.error(`第 ${i + 1} 行失败: ${err.message}`);
    }
  }

  if (changed) {
    fs.writeFileSync(CLIPPING_PATH, lines.join("\n"), "utf8");
    console.log("✅ 完成，图片已本地化");
  } else {
    console.log("没有可处理的远程图片");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
