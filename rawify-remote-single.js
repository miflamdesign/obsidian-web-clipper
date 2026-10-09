const path = require("node:path");
const { getVaultPaths, processFile } = require("./rawify-common.js");

const CLIPS_DIR = "raw/clips";
const ASSETS_DIR = "raw/assets";

async function main() {
  const vaultRoot = process.argv[2];
  const fileName = process.argv[3];
  if (!vaultRoot || !fileName) {
    console.error("用法: node rawify-remote-single.js /path/to/your/vault article.md");
    process.exitCode = 1;
    return;
  }

  const { clipsDir, assetsDir } = getVaultPaths(vaultRoot, CLIPS_DIR, ASSETS_DIR);
  const mdPath = path.join(clipsDir, path.basename(fileName));
  const result = await processFile(mdPath, assetsDir);
  console.log(result.skipped ? "没有可处理的远程图片" : `完成：保存 ${result.saved} 张图片，失败 ${result.failed} 张`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
