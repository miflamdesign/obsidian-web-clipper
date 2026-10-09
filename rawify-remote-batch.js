const { processClippingFiles } = require("./rawify-common.js");

const CLIPS_DIR = "raw/clips";
const ASSETS_DIR = "raw/assets";

async function main() {
  const vaultRoot = process.argv[2];
  if (!vaultRoot) {
    console.error("用法: node rawify-remote-batch.js /path/to/your/vault");
    process.exitCode = 1;
    return;
  }

  const result = await processClippingFiles(vaultRoot, CLIPS_DIR, ASSETS_DIR);
  console.log(`完成：${result.files} 个文件，保存 ${result.saved} 张图片，失败 ${result.failed} 张，跳过 ${result.skipped} 个文件`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
