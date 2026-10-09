const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

for (const script of ["rawify-remote-batch.js", "rawify-remote-single.js"]) {
  test(`${script} prints usage when the Vault path is missing`, () => {
    const result = spawnSync(process.execPath, [path.join(root, script)], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /用法|Usage/);
  });
}

test("image backfill scripts use the portable clipping and asset directories", () => {
  for (const script of ["rawify-remote-batch.js", "rawify-remote-single.js"]) {
    const source = fs.readFileSync(path.join(root, script), "utf8");
    assert.match(source, /raw[\\/]clips/);
    assert.match(source, /raw[\\/]assets/);
    assert.doesNotMatch(source, /Louis_OB_Base/);
  }
});
