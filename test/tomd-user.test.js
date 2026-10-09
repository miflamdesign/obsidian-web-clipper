const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const scriptPath = require.resolve("../tomd.user.js");

test("userscript exposes the current structured clipboard contract", () => {
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /__clip_type:\s*["']kb-clip-v3["']/);
  assert.match(source, /GM_setClipboard\(JSON\.stringify\(clipData\)/);
  assert.match(source, /canonical_url/);
  assert.match(source, /publish_date/);
  assert.match(source, /page_url/);
  assert.match(source, /obsidian:\/\/quickadd\?/);
  assert.match(source, /button\.id = ["']local-obsidian-clip-button["']/);
});

test("userscript uses article extraction dependencies and excludes page chrome", () => {
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /Readability/);
  assert.match(source, /TurndownService/);
  assert.match(source, /script, style, iframe, noscript/);
});
