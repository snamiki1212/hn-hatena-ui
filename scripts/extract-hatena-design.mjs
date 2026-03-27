#!/usr/bin/env node

/**
 * はてなブックマークのデザイン情報を自動抽出するスクリプト
 *
 * Usage:
 *   node scripts/extract-hatena-design.mjs                    # 直接取得 (ローカル向け)
 *   node scripts/extract-hatena-design.mjs --archive          # Wayback Machine 経由
 *   node scripts/extract-hatena-design.mjs --screenshot       # スクリーンショットも取得
 *   node scripts/extract-hatena-design.mjs --archive --screenshot
 *
 * 出力:
 *   docs/design/tokens.json       - デザイントークン
 *   docs/design/structure.json    - UI構造データ
 *   docs/design/raw/              - 取得したHTML (キャッシュ)
 *   docs/design/screenshots/      - スクリーンショット (--screenshot時)
 */

import * as cheerio from "cheerio";
import { writeFile, readFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DESIGN_DIR = join(ROOT, "docs", "design");
const RAW_DIR = join(DESIGN_DIR, "raw");
const SCREENSHOTS_DIR = join(DESIGN_DIR, "screenshots");
const TOKENS_PATH = join(DESIGN_DIR, "tokens.json");
const STRUCTURE_PATH = join(DESIGN_DIR, "structure.json");

const TARGETS = [
  { name: "top", url: "https://b.hatena.ne.jp/" },
  { name: "hotentry-it", url: "https://b.hatena.ne.jp/hotentry/it" },
  { name: "hotentry-all", url: "https://b.hatena.ne.jp/hotentry/all" },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── CLI引数パース ───────────────────────────────────────

const args = process.argv.slice(2);
const useArchive = args.includes("--archive");
const doScreenshots = args.includes("--screenshot");

// ─── HTML取得 ────────────────────────────────────────────

async function fetchDirect(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.text();
}

async function fetchFromArchive(url) {
  // Wayback Machine の最新スナップショットURLを取得
  const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Wayback API error: ${res.status}`);

  const data = await res.json();
  const snapshot = data?.archived_snapshots?.closest;
  if (!snapshot?.available) {
    throw new Error(`No Wayback snapshot found for: ${url}`);
  }

  console.log(`   archive: ${snapshot.timestamp} (${snapshot.url})`);
  const html = await fetchDirect(snapshot.url);
  return html;
}

async function fetchHTML(url) {
  return useArchive ? fetchFromArchive(url) : fetchDirect(url);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─── 構造解析 ────────────────────────────────────────────

function extractStructure($) {
  const structure = {
    header: null,
    categories: [],
    entries: [],
    sidebar: null,
    footer: null,
  };

  // ヘッダー
  const $header =
    $("header").first().length > 0
      ? $("header").first()
      : $('[class*="header" i], [id*="header" i]').first();
  if ($header.length) {
    structure.header = {
      tag: $header.prop("tagName"),
      classes: ($header.attr("class") || "").split(/\s+/).filter(Boolean),
      children: $header
        .children()
        .map((_, el) => ({
          tag: $(el).prop("tagName"),
          classes: ($(el).attr("class") || "").split(/\s+/).filter(Boolean),
          text: $(el).text().trim().slice(0, 100),
        }))
        .get(),
    };
  }

  // カテゴリ・ナビゲーション
  $(
    '[class*="category" i], [class*="tab" i], nav a, [class*="topic" i]'
  ).each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") || "";
    if (text && text.length < 30) {
      structure.categories.push({ text, href });
    }
  });
  const seen = new Set();
  structure.categories = structure.categories.filter((c) => {
    if (seen.has(c.text)) return false;
    seen.add(c.text);
    return true;
  });

  // エントリーカード
  $(
    '[class*="entry" i], [class*="item" i], [class*="card" i], article'
  ).each((_, el) => {
    const $el = $(el);
    const title =
      $el.find("a").first().text().trim() ||
      $el.find('[class*="title" i]').text().trim();
    const href = $el.find("a").first().attr("href") || "";
    const bookmarkCount = $el
      .find('[class*="bookmark" i], [class*="count" i], [class*="user" i]')
      .text()
      .trim();

    if (title && title.length > 5 && title.length < 200) {
      structure.entries.push({
        tag: $el.prop("tagName"),
        classes: ($el.attr("class") || "").split(/\s+/).filter(Boolean),
        title: title.slice(0, 100),
        href: href.slice(0, 200),
        bookmarkCount: bookmarkCount.slice(0, 20),
        childTags: $el
          .children()
          .map((_, c) => $(c).prop("tagName"))
          .get(),
      });
    }
  });
  structure.entries = structure.entries.slice(0, 20);

  // フッター
  const $footer =
    $("footer").first().length > 0
      ? $("footer").first()
      : $('[class*="footer" i]').first();
  if ($footer.length) {
    structure.footer = {
      tag: $footer.prop("tagName"),
      classes: ($footer.attr("class") || "").split(/\s+/).filter(Boolean),
      links: $footer
        .find("a")
        .map((_, a) => ({
          text: $(a).text().trim(),
          href: $(a).attr("href") || "",
        }))
        .get()
        .slice(0, 20),
    };
  }

  return structure;
}

// ─── CSS抽出 ─────────────────────────────────────────────

function extractColors($) {
  const colors = new Map();
  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

  $("style").each((_, el) => {
    const css = $(el).text();
    let match;
    while ((match = colorRegex.exec(css)) !== null) {
      const color = match[0].toLowerCase();
      colors.set(color, (colors.get(color) || 0) + 1);
    }
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    let match;
    while ((match = colorRegex.exec(style)) !== null) {
      const color = match[0].toLowerCase();
      colors.set(color, (colors.get(color) || 0) + 1);
    }
  });

  return [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color, count }));
}

function extractFonts($) {
  const fonts = new Set();
  const fontRegex = /font-family:\s*([^;}{]+)/g;

  $("style").each((_, el) => {
    let match;
    while ((match = fontRegex.exec($(el).text())) !== null) {
      fonts.add(match[1].trim());
    }
  });

  $("[style]").each((_, el) => {
    let match;
    while ((match = fontRegex.exec($(el).attr("style") || "")) !== null) {
      fonts.add(match[1].trim());
    }
  });

  return [...fonts];
}

function extractFontSizes($) {
  const sizes = new Map();
  const sizeRegex = /font-size:\s*([^;}{]+)/g;

  $("style").each((_, el) => {
    let match;
    while ((match = sizeRegex.exec($(el).text())) !== null) {
      const size = match[1].trim();
      sizes.set(size, (sizes.get(size) || 0) + 1);
    }
  });

  return [...sizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([size, count]) => ({ size, count }));
}

function extractSpacing($) {
  const spacings = new Map();
  const spacingRegex =
    /(?:margin|padding|gap)(?:-(?:top|right|bottom|left))?:\s*([^;}{]+)/g;

  $("style").each((_, el) => {
    let match;
    while ((match = spacingRegex.exec($(el).text())) !== null) {
      const value = match[1].trim();
      spacings.set(value, (spacings.get(value) || 0) + 1);
    }
  });

  return [...spacings.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([value, count]) => ({ value, count }));
}

// ─── スクリーンショット (オプション) ──────────────────────

async function takeScreenshots(targets) {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer-core");
  } catch {
    try {
      puppeteer = await import("puppeteer");
    } catch {
      console.warn("  puppeteer not available, skipping screenshots");
      return false;
    }
  }

  const browserPaths = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  let browser;
  for (const executablePath of browserPaths) {
    try {
      browser = await puppeteer.default.launch({
        executablePath,
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      break;
    } catch {
      continue;
    }
  }

  if (!browser) {
    console.warn("  No browser found, skipping screenshots");
    console.warn(
      "  Set CHROME_PATH env var or install Chrome/Chromium to enable"
    );
    return false;
  }

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  for (const target of targets) {
    const url = useArchive ? await getArchiveUrl(target.url) : target.url;
    console.log(`  screenshot: ${target.name}`);
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    // デスクトップ
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${target.name}-desktop.png`),
      fullPage: true,
    });

    // モバイル
    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${target.name}-mobile.png`),
      fullPage: true,
    });

    // エントリーカード拡大
    const card = await page.$(
      '[class*="entry" i], article, [class*="item" i]'
    );
    if (card) {
      await card.screenshot({
        path: join(SCREENSHOTS_DIR, `${target.name}-card.png`),
      });
    }

    // Computed styles (ブラウザでしか取れない値)
    const computed = await page.evaluate(() => {
      const get = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el) : null;
      };

      const pick = (style, props) =>
        style
          ? Object.fromEntries(props.map((p) => [p, style[p]]))
          : null;

      return {
        body: pick(get("body"), [
          "fontFamily",
          "fontSize",
          "color",
          "backgroundColor",
          "lineHeight",
        ]),
        header: pick(get('header, [class*="header" i]'), [
          "backgroundColor",
          "height",
          "borderBottom",
          "padding",
        ]),
        entryCard: pick(get('[class*="entry" i], article'), [
          "backgroundColor",
          "padding",
          "margin",
          "border",
          "borderBottom",
        ]),
        entryTitle: pick(
          get(
            '[class*="entry" i] a, article a, [class*="title" i] a'
          ),
          ["color", "fontSize", "fontWeight", "lineHeight", "textDecoration"]
        ),
        link: pick(get("a[href]"), ["color", "textDecoration"]),
      };
    });

    await writeFile(
      join(DESIGN_DIR, `computed-${target.name}.json`),
      JSON.stringify(computed, null, 2)
    );

    await page.close();
  }

  await browser.close();
  return true;
}

async function getArchiveUrl(url) {
  const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
  const data = await res.json();
  return data?.archived_snapshots?.closest?.url || url;
}

// ─── 集約ユーティリティ ──────────────────────────────────

function mergeCountMap(items, keyField) {
  const map = new Map();
  for (const item of items) {
    const key = item[keyField];
    map.set(key, (map.get(key) || 0) + item.count);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ [keyField]: value, count }));
}

// ─── デザイントークン生成 ─────────────────────────────────

function generateTokens(colors, fonts, fontSizes, spacing, prevTokens) {
  // 前回の semantic 値を保持 (手動修正を上書きしない)
  const prevSemantic = prevTokens?.color?.semantic || {};
  const prevFontSemantic = prevTokens?.fontSize?.semantic || {};

  const defaultSemantic = {
    "hatena-blue": "#1d7ab3",
    "hatena-blue-hover": "#166a9e",
    "bg-primary": "#ffffff",
    "bg-secondary": "#f5f5f5",
    border: "#e8e8e8",
    "text-primary": "#333333",
    "text-secondary": "#666666",
    "text-muted": "#999999",
    "bookmark-cold": "#f0f0f0",
    "bookmark-warm": "#ff9900",
    "bookmark-hot": "#ff6666",
    "bookmark-fire": "#ff3333",
  };

  const defaultFontSemantic = {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "15px",
    lg: "18px",
  };

  return {
    _generated: new Date().toISOString(),
    _source: useArchive
      ? "https://web.archive.org/ (via b.hatena.ne.jp)"
      : "https://b.hatena.ne.jp/",
    _note:
      "Auto-extracted + semantic tokens. Edit semantic values freely; they are preserved across runs.",
    color: {
      extracted: colors.slice(0, 30),
      semantic: { ...defaultSemantic, ...prevSemantic },
    },
    font: {
      extracted: fonts,
      family: {
        base:
          prevTokens?.font?.family?.base ||
          '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
      },
    },
    fontSize: {
      extracted: fontSizes.slice(0, 15),
      semantic: { ...defaultFontSemantic, ...prevFontSemantic },
    },
    spacing: {
      extracted: spacing,
    },
    breakpoint: prevTokens?.breakpoint || { sm: "768px", md: "1100px" },
    borderRadius: prevTokens?.borderRadius || { sm: "3px", md: "6px" },
  };
}

// ─── メイン ──────────────────────────────────────────────

async function main() {
  const mode = useArchive ? "archive" : "direct";
  console.log(`\n  hatena-bookmark design extractor (mode: ${mode})\n`);

  await mkdir(DESIGN_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });

  // 前回のトークンを読み込み (semantic値の保持用)
  let prevTokens = null;
  if (await fileExists(TOKENS_PATH)) {
    try {
      prevTokens = JSON.parse(await readFile(TOKENS_PATH, "utf-8"));
      console.log(`  Previous tokens loaded (${prevTokens._generated})\n`);
    } catch {
      // ignore
    }
  }

  const allStructures = {};
  let allColors = [];
  let allFonts = [];
  let allFontSizes = [];
  let allSpacing = [];

  for (const target of TARGETS) {
    console.log(`  fetch: ${target.name} (${target.url})`);
    try {
      const html = await fetchHTML(target.url);

      // HTMLをキャッシュ保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await writeFile(
        join(RAW_DIR, `${target.name}_${timestamp}.html`),
        html
      );

      const $ = cheerio.load(html);

      const structure = extractStructure($);
      allStructures[target.name] = structure;

      const colors = extractColors($);
      const fonts = extractFonts($);
      const fontSizes = extractFontSizes($);
      const spacing = extractSpacing($);

      allColors.push(...colors);
      allFonts.push(...fonts);
      allFontSizes.push(...fontSizes);
      allSpacing.push(...spacing);

      console.log(
        `    entries: ${structure.entries.length}, categories: ${structure.categories.length}, colors: ${colors.length}`
      );
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      // キャッシュ済みHTMLがあれば使う
      const cached = await findLatestCache(target.name);
      if (cached) {
        console.log(`    using cached HTML: ${cached.file}`);
        const $ = cheerio.load(cached.html);
        allStructures[target.name] = extractStructure($);
        allColors.push(...extractColors($));
        allFonts.push(...extractFonts($));
        allFontSizes.push(...extractFontSizes($));
        allSpacing.push(...extractSpacing($));
      }
    }
  }

  // 集約
  const mergedColors = mergeCountMap(allColors, "color");
  const mergedFonts = [...new Set(allFonts)];
  const mergedSizes = mergeCountMap(allFontSizes, "size");
  const mergedSpacing = mergeCountMap(allSpacing, "value").slice(0, 30);

  // 出力
  await writeFile(STRUCTURE_PATH, JSON.stringify(allStructures, null, 2));
  console.log(`\n  saved: ${STRUCTURE_PATH}`);

  const tokens = generateTokens(
    mergedColors,
    mergedFonts,
    mergedSizes,
    mergedSpacing,
    prevTokens
  );
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`  saved: ${TOKENS_PATH}`);

  // スクリーンショット
  if (doScreenshots) {
    console.log(`\n  taking screenshots...`);
    const success = await takeScreenshots(TARGETS);
    if (success) {
      console.log(`  saved: ${SCREENSHOTS_DIR}`);
    }
  }

  // サマリー
  console.log("\n  ── summary ──────────────────────────");
  console.log(`  colors:  ${mergedColors.length} (top: ${mergedColors.slice(0, 5).map((c) => c.color).join(", ") || "none"})`);
  console.log(`  fonts:   ${mergedFonts.length > 0 ? mergedFonts.join(" | ") : "(none in HTML, see computed-*.json with --screenshot)"}`);
  console.log(`  sizes:   ${mergedSizes.slice(0, 5).map((s) => s.size).join(", ") || "none"}`);
  console.log(`  entries: ${Object.values(allStructures).reduce((sum, s) => sum + s.entries.length, 0)}`);
  if (!doScreenshots) {
    console.log(`\n  tip: run with --screenshot for computed styles & screenshots`);
  }
  console.log("");
}

async function findLatestCache(name) {
  const { readdir } = await import("node:fs/promises");
  try {
    const files = await readdir(RAW_DIR);
    const matching = files
      .filter((f) => f.startsWith(name) && f.endsWith(".html"))
      .sort()
      .reverse();
    if (matching.length === 0) return null;
    const file = matching[0];
    const html = await readFile(join(RAW_DIR, file), "utf-8");
    return { file, html };
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
