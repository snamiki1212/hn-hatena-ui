#!/usr/bin/env node

/**
 * はてなブックマークのデザイン情報を自動抽出するスクリプト
 *
 * 機能:
 * 1. HTML取得 + 構造解析 (cheerio)
 * 2. インラインCSS・style要素からカラー・フォント抽出
 * 3. スクリーンショット取得 (Puppeteer / ローカル環境のみ)
 * 4. デザイントークン (tokens.json) 生成
 *
 * Usage:
 *   node scripts/extract-hatena-design.mjs                  # HTML解析のみ
 *   node scripts/extract-hatena-design.mjs --screenshot     # スクリーンショットも取得
 */

import * as cheerio from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DESIGN_DIR = join(ROOT, "docs", "design");
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

// ─── HTML取得 ────────────────────────────────────────────

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.text();
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
  // 重複排除
  const seen = new Set();
  structure.categories = structure.categories.filter((c) => {
    const key = c.text;
    if (seen.has(key)) return false;
    seen.add(key);
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
    const bookmarkCount =
      $el.find('[class*="bookmark" i], [class*="count" i], [class*="user" i]').text().trim();

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
  // 最大20件に絞る
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

  // style要素からカラー値を抽出
  $("style").each((_, el) => {
    const css = $(el).text();
    const colorRegex =
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    let match;
    while ((match = colorRegex.exec(css)) !== null) {
      const color = match[0].toLowerCase();
      colors.set(color, (colors.get(color) || 0) + 1);
    }
  });

  // インラインstyleからも抽出
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const colorRegex =
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    let match;
    while ((match = colorRegex.exec(style)) !== null) {
      const color = match[0].toLowerCase();
      colors.set(color, (colors.get(color) || 0) + 1);
    }
  });

  // 出現頻度順にソート
  return [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color, count }));
}

function extractFonts($) {
  const fonts = new Set();

  $("style").each((_, el) => {
    const css = $(el).text();
    const fontRegex = /font-family:\s*([^;}{]+)/g;
    let match;
    while ((match = fontRegex.exec(css)) !== null) {
      fonts.add(match[1].trim());
    }
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const fontRegex = /font-family:\s*([^;]+)/g;
    let match;
    while ((match = fontRegex.exec(style)) !== null) {
      fonts.add(match[1].trim());
    }
  });

  return [...fonts];
}

function extractFontSizes($) {
  const sizes = new Map();

  $("style").each((_, el) => {
    const css = $(el).text();
    const sizeRegex = /font-size:\s*([^;}{]+)/g;
    let match;
    while ((match = sizeRegex.exec(css)) !== null) {
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

  $("style").each((_, el) => {
    const css = $(el).text();
    const spacingRegex =
      /(?:margin|padding|gap)(?:-(?:top|right|bottom|left))?:\s*([^;}{]+)/g;
    let match;
    while ((match = spacingRegex.exec(css)) !== null) {
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
      console.warn("⚠ puppeteer not available, skipping screenshots");
      return false;
    }
  }

  // ブラウザパスを検出
  const browserPaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    process.env.CHROME_PATH,
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
    console.warn("⚠ No browser found, skipping screenshots");
    console.warn(
      "  Set CHROME_PATH env var or install Chrome/Chromium to enable screenshots"
    );
    return false;
  }

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  for (const target of targets) {
    console.log(`📸 Screenshot: ${target.name} (${target.url})`);
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    // デスクトップ
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(target.url, { waitUntil: "networkidle2", timeout: 30000 });
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
    const card = await page.$('[class*="entry" i], article, [class*="item" i]');
    if (card) {
      await card.screenshot({
        path: join(SCREENSHOTS_DIR, `${target.name}-card.png`),
      });
    }

    // Computed styles 抽出 (Puppeteerでしかできない)
    const computedTokens = await page.evaluate(() => {
      const result = {};

      const body = document.body;
      const bodyStyle = getComputedStyle(body);
      result.body = {
        fontFamily: bodyStyle.fontFamily,
        fontSize: bodyStyle.fontSize,
        color: bodyStyle.color,
        backgroundColor: bodyStyle.backgroundColor,
      };

      // ヘッダー
      const header = document.querySelector(
        'header, [class*="header" i]'
      );
      if (header) {
        const s = getComputedStyle(header);
        result.header = {
          backgroundColor: s.backgroundColor,
          height: s.height,
          borderBottom: s.borderBottom,
        };
      }

      // 最初のエントリーカード
      const entry = document.querySelector(
        '[class*="entry" i], article, [class*="item" i]'
      );
      if (entry) {
        const s = getComputedStyle(entry);
        result.entryCard = {
          backgroundColor: s.backgroundColor,
          padding: s.padding,
          margin: s.margin,
          border: s.border,
          fontSize: s.fontSize,
        };

        const title = entry.querySelector("a, [class*='title' i]");
        if (title) {
          const ts = getComputedStyle(title);
          result.entryTitle = {
            color: ts.color,
            fontSize: ts.fontSize,
            fontWeight: ts.fontWeight,
            lineHeight: ts.lineHeight,
          };
        }
      }

      // リンク
      const link = document.querySelector("a");
      if (link) {
        result.link = {
          color: getComputedStyle(link).color,
        };
      }

      return result;
    });

    await writeFile(
      join(DESIGN_DIR, `computed-${target.name}.json`),
      JSON.stringify(computedTokens, null, 2)
    );

    await page.close();
  }

  await browser.close();
  return true;
}

// ─── デザイントークン生成 ─────────────────────────────────

function generateTokens(allColors, allFonts, allFontSizes, allSpacing) {
  // 出現頻度が高い色をトークン候補に
  const topColors = allColors.slice(0, 20);

  return {
    _generated: new Date().toISOString(),
    _source: "https://b.hatena.ne.jp/",
    _note:
      "Auto-extracted values. Verify with DevTools and update manually if needed.",
    color: {
      extracted: topColors,
      // 手動マッピング用テンプレート (design.mdの値をデフォルトに)
      semantic: {
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
      },
    },
    font: {
      extracted: allFonts,
      family: {
        base: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
      },
    },
    fontSize: {
      extracted: allFontSizes.slice(0, 15),
      semantic: {
        xs: "11px",
        sm: "12px",
        base: "14px",
        md: "15px",
        lg: "18px",
      },
    },
    spacing: {
      extracted: allSpacing,
    },
    breakpoint: {
      sm: "768px",
      md: "1100px",
    },
    borderRadius: {
      sm: "3px",
      md: "6px",
    },
  };
}

// ─── メイン ──────────────────────────────────────────────

async function main() {
  const doScreenshots = process.argv.includes("--screenshot");

  console.log("🔍 はてなブックマーク デザイン情報抽出\n");

  await mkdir(DESIGN_DIR, { recursive: true });

  const allStructures = {};
  const allColors = [];
  const allFonts = [];
  const allFontSizes = [];
  const allSpacing = [];

  for (const target of TARGETS) {
    console.log(`📄 Fetching: ${target.name} (${target.url})`);
    try {
      const html = await fetchHTML(target.url);
      const $ = cheerio.load(html);

      // 構造解析
      const structure = extractStructure($);
      allStructures[target.name] = structure;
      console.log(
        `   → entries: ${structure.entries.length}, categories: ${structure.categories.length}`
      );

      // CSS抽出
      const colors = extractColors($);
      const fonts = extractFonts($);
      const fontSizes = extractFontSizes($);
      const spacing = extractSpacing($);

      allColors.push(...colors);
      allFonts.push(...fonts);
      allFontSizes.push(...fontSizes);
      allSpacing.push(...spacing);

      console.log(
        `   → colors: ${colors.length}, fonts: ${fonts.length}, sizes: ${fontSizes.length}`
      );
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}`);
    }
  }

  // 色の集約・重複排除
  const colorMap = new Map();
  for (const { color, count } of allColors) {
    colorMap.set(color, (colorMap.get(color) || 0) + count);
  }
  const mergedColors = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color, count }));

  // フォントの重複排除
  const mergedFonts = [...new Set(allFonts)];

  // フォントサイズの集約
  const sizeMap = new Map();
  for (const { size, count } of allFontSizes) {
    sizeMap.set(size, (sizeMap.get(size) || 0) + count);
  }
  const mergedSizes = [...sizeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([size, count]) => ({ size, count }));

  // スペーシングの集約
  const spacingMap = new Map();
  for (const { value, count } of allSpacing) {
    spacingMap.set(value, (spacingMap.get(value) || 0) + count);
  }
  const mergedSpacing = [...spacingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([value, count]) => ({ value, count }));

  // 構造 JSON 保存
  await writeFile(STRUCTURE_PATH, JSON.stringify(allStructures, null, 2));
  console.log(`\n✅ Structure saved: ${STRUCTURE_PATH}`);

  // デザイントークン生成・保存
  const tokens = generateTokens(
    mergedColors,
    mergedFonts,
    mergedSizes,
    mergedSpacing
  );
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`✅ Tokens saved: ${TOKENS_PATH}`);

  // スクリーンショット
  if (doScreenshots) {
    console.log("\n📸 Taking screenshots...");
    const success = await takeScreenshots(TARGETS);
    if (success) {
      console.log(`✅ Screenshots saved: ${SCREENSHOTS_DIR}`);
    }
  } else {
    console.log(
      "\nℹ  Run with --screenshot to capture screenshots (requires Chrome/Chromium)"
    );
  }

  // サマリー
  console.log("\n── Summary ──────────────────────────");
  console.log(`Colors extracted: ${mergedColors.length}`);
  console.log(`Top colors: ${mergedColors.slice(0, 5).map((c) => c.color).join(", ")}`);
  console.log(`Fonts: ${mergedFonts.length > 0 ? mergedFonts.join(" | ") : "(none in HTML)"}`);
  console.log(`Font sizes: ${mergedSizes.slice(0, 5).map((s) => s.size).join(", ")}`);
  console.log(`Entries found: ${Object.values(allStructures).reduce((sum, s) => sum + s.entries.length, 0)}`);
  console.log("─────────────────────────────────────");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
