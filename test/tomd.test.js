const test = require("node:test");
const assert = require("node:assert/strict");

const tomd = require("../tomd.js");

test("parses a valid kb-clip-v3 clipboard payload", () => {
  const result = tomd.parseClipboard(JSON.stringify({
    __clip_type: "kb-clip-v3",
    title: "网页资料",
    page_url: "https://example.com/article",
    markdown: "这是长度足够的正文内容，用于测试剪贴板协议。",
  }));

  assert.equal(result.mode, "clip");
  assert.equal(result.data.title, "网页资料");
  assert.equal(result.data.page_url, "https://example.com/article");
});

test("rejects malformed and too-short clipboard content", () => {
  assert.throws(() => tomd.parseClipboard("{not-json"), /剪贴板内容不是有效的 JSON/);
  assert.throws(() => tomd.parseClipboard(JSON.stringify({
    __clip_type: "kb-clip-v3",
    title: "短内容",
    markdown: "太短",
  })), /正文内容过短/);
});

test("normalizes tracking parameters without dropping WeChat identity parameters", () => {
  assert.equal(
    tomd.normalizeClipUrl("HTTPS://Example.com/a/?utm_source=x&b=2&a=1#part"),
    "https://example.com/a?a=1&b=2"
  );
  assert.match(
    tomd.normalizeClipUrl("https://mp.weixin.qq.com/s?__biz=abc&mid=12&idx=1&sn=xyz"),
    /__biz=abc/
  );
});

test("finds duplicates through normalized page or canonical URLs", () => {
  const data = {
    page_url: "https://example.com/article?utm_campaign=one",
    canonical_url: "https://example.com/article",
  };
  const files = [{
    path: "raw/clips/2026-10-09-网页资料.md",
    content: [
      "---",
      'page_url: "https://example.com/article#section"',
      'canonical_url: ""',
      "---",
      "正文",
    ].join("\n"),
  }];

  assert.equal(tomd.findDuplicateClip(data, files).path, files[0].path);
});

test("adds a short URL suffix when a different source uses the same title", () => {
  const path = tomd.buildClipPath({
    title: "相同标题",
    collected_date: "2026-10-09",
    page_url: "https://example.com/second",
  }, new Set(["raw/clips/2026-10-09-相同标题.md"]));

  assert.match(path, /^raw\/clips\/2026-10-09-相同标题-[0-9a-f]{8}\.md$/);
});

test("builds frontmatter with the local archive fields", () => {
  const frontmatter = tomd.buildFrontmatter({
    title: '带"引号"的标题',
    author: "作者",
    source: "https://example.com/article",
    page_url: "https://example.com/article",
    canonical_url: "https://example.com/article",
    publish_date: "2026-10-08",
    collected_date: "2026-10-09",
  }, "2026-10-09");

  assert.match(frontmatter, /title: "带\\"引号\\"的标题"/);
  assert.match(frontmatter, /date: 2026-10-08/);
  assert.match(frontmatter, /collected: 2026-10-09/);
  assert.match(frontmatter, /- raw/);
});

test("keeps an image URL when one download fails", async () => {
  const written = [];
  const app = {
    vault: {
      adapter: {
        async exists() { return true; },
        async mkdir() {},
        async writeBinary(filePath, bytes) { written.push({ filePath, bytes }); },
      },
    },
  };
  let attempts = 0;
  const result = await tomd.downloadImages(app, [
    "![成功图片](https://example.com/ok.png)",
    "![失败图片](https://example.com/fail.png)",
  ].join("\n"), "raw/clips/2026-10-09-网页资料.md", {
    requestUrl: async ({ url }) => {
      attempts += 1;
      if (url.endsWith("fail.png")) throw new Error("network error");
      return {
        headers: { "content-type": "image/png" },
        arrayBuffer: new ArrayBuffer(4),
      };
    },
  });

  assert.equal(attempts, 2);
  assert.equal(result.saved, 1);
  assert.equal(result.failed, 1);
  assert.match(result.markdown, /!\[\[img-001-[0-9a-f]{8}\.png\]\]/);
  assert.match(result.markdown, /!\[失败图片\]\(https:\/\/example\.com\/fail\.png\)/);
  assert.equal(written.length, 1);
});
