const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const readme = fs.readFileSync("README.md", "utf8");

test("README describes the local browser-to-Obsidian workflow", () => {
  assert.match(readme, /油猴|Userscript|用户脚本/);
  assert.match(readme, /剪贴板/);
  assert.match(readme, /QuickAdd/);
  assert.match(readme, /raw\/clips/);
  assert.match(readme, /raw\/assets/);
  assert.doesNotMatch(readme, /API_KEY|tomd\.ou\.al|填入 API Key|远程转换服务/);
  assert.match(readme, /MIT License/);
  assert.match(readme, /CONTRIBUTING\.md/);
});
