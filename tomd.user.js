// ==UserScript==
// @name         网页资料存入 Obsidian
// @namespace    local-obsidian-clipper
// @version      4.0.0
// @description  提取网页正文和元数据，整理成 Markdown 后交给 Obsidian QuickAdd
// @match        *://*/*
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
// @require      https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const OBSIDIAN_URI = "obsidian://quickadd?vault=Knowledge%20OS&choice=tomd";
  const BUTTON_TOP_KEY = "local-obsidian-clip-button-top";

  function localDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s*[-|｜–—]\s*(人人都是产品经理|少数派|知乎|微信公众号).*$/i, "")
      .trim();
  }

  function readMeta(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.getAttribute("content") || element?.textContent;
      if (cleanText(value)) return cleanText(value);
    }
    return "";
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, location.href);
      url.hash = "";
      if (location.hostname.includes("mp.weixin.qq.com")) {
        const source = url.searchParams.get("s");
        url.search = source ? `?s=${encodeURIComponent(source)}` : "";
      } else {
        url.search = "";
      }
      return url.toString();
    } catch {
      return value || location.href;
    }
  }

  function getImageSource(node) {
    return node.getAttribute("data-src") ||
      node.getAttribute("data-original") ||
      node.getAttribute("src") ||
      "";
  }

  function createConverter() {
    const converter = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
    });

    converter.addRule("images", {
      filter: "img",
      replacement: function (content, node) {
        const source = getImageSource(node);
        if (!source) return "";
        const alt = cleanText(node.getAttribute("alt"));
        return `![${alt}](${source})`;
      },
    });

    converter.addRule("codeBlocks", {
      filter: (node) => node.nodeName === "PRE",
      replacement: (content, node) => {
        const code = node.querySelector("code");
        const language = cleanText(code?.className || "").replace(/^language-/, "");
        const text = (code || node).textContent.replace(/\n+$/, "");
        return `\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`;
      },
    });

    return converter;
  }

  function extractArticle() {
    const clone = document.cloneNode(true);
    clone.querySelectorAll("script, style, iframe, noscript").forEach((node) => node.remove());

    const parsed = new Readability(clone, { charThreshold: 100 }).parse();
    if (parsed?.content && cleanText(parsed.textContent).length >= 20) return parsed;

    const fallback = clone.querySelector("article, main, [role='main']") || clone.body;
    return {
      title: document.title,
      content: fallback?.innerHTML || "",
      textContent: fallback?.textContent || "",
    };
  }

  function extractPublishDate() {
    const raw = readMeta([
      "#publish_time",
      "meta[property='article:published_time']",
      "meta[name='date']",
      "time[datetime]",
      "[itemprop='datePublished']",
    ]);
    const match = raw.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
    return match ? match[0].replace(/[/.]/g, "-") : "";
  }

  function extractAuthor() {
    return readMeta([
      "#js_author_name",
      "meta[name='author']",
      "meta[property='article:author']",
      "[rel='author']",
      "[itemprop='author']",
    ]);
  }

  function collect() {
    const article = extractArticle();
    const markdown = createConverter().turndown(article.content)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (markdown.length < 20) {
      throw new Error("没有提取到足够的正文内容");
    }

    const canonical = document.querySelector("link[rel='canonical']")?.href || location.href;
    const clipData = {
      __clip_type: "kb-clip-v3",
      title: cleanTitle(article.title || document.title) || "未命名网页",
      author: extractAuthor(),
      source: normalizeUrl(canonical),
      page_url: location.href,
      canonical_url: normalizeUrl(canonical),
      publish_date: extractPublishDate(),
      collected_date: localDate(),
      markdown,
      source_site: location.hostname,
    };

    GM_setClipboard(JSON.stringify(clipData), "text");
    window.location.href = OBSIDIAN_URI;
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = "local-obsidian-clip-button";
    button.type = "button";
    button.textContent = "📥";
    button.title = "整理到 Obsidian";
    button.setAttribute("aria-label", "整理到 Obsidian");
    button.style.cssText = [
      "position: fixed",
      "right: 20px",
      `top: ${Number(localStorage.getItem(BUTTON_TOP_KEY)) || Math.round(window.innerHeight * 0.65)}px`,
      "z-index: 2147483647",
      "width: 44px",
      "height: 44px",
      "border: 0",
      "border-radius: 50%",
      "background: #7c3aed",
      "color: #fff",
      "font-size: 21px",
      "line-height: 44px",
      "text-align: center",
      "cursor: grab",
      "box-shadow: 0 3px 14px rgba(0, 0, 0, .25)",
    ].join(";");

    let dragging = false;
    let moved = false;
    let offset = 0;

    button.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      offset = event.clientY - button.getBoundingClientRect().top;
      button.setPointerCapture(event.pointerId);
      button.style.cursor = "grabbing";
    });

    button.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      moved = true;
      const top = Math.max(8, Math.min(window.innerHeight - 52, event.clientY - offset));
      button.style.top = `${top}px`;
    });

    button.addEventListener("pointerup", () => {
      dragging = false;
      button.style.cursor = "grab";
      localStorage.setItem(BUTTON_TOP_KEY, String(parseFloat(button.style.top)));
    });

    button.addEventListener("click", () => {
      if (moved) return;
      button.textContent = "⏳";
      try {
        collect();
      } catch (error) {
        button.textContent = "❌";
        alert(error.message || "网页整理失败");
        setTimeout(() => { button.textContent = "📥"; }, 1600);
      }
    });

    document.body.appendChild(button);
  }

  if (document.body && !document.getElementById("local-obsidian-clip-button")) {
    createButton();
  }
})();
