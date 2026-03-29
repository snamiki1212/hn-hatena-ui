#!/usr/bin/env node

/**
 * GHA にプッシュする前にローカルで検証するスクリプト
 *
 * 1. 全スクリプトの構文チェック
 * 2. extract-hatena-design.mjs をテストデータで実行
 * 3. update-design-doc.mjs を実行
 * 4. 生成ファイルの妥当性チェック
 *
 * Usage:
 *   node scripts/validate.mjs
 */

import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DESIGN_DIR = join(ROOT, "docs", "design");

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`  FAIL  ${label}`);
  if (err) console.error(`         ${err}`);
  failed++;
}

// ─── 1. 構文チェック ─────────────────────────────────────

async function syntaxCheck() {
  console.log("\n--- Syntax Check ---\n");

  const scripts = [
    "scripts/extract-hatena-design.mjs",
    "scripts/update-design-doc.mjs",
    "scripts/validate.mjs",
  ];

  for (const script of scripts) {
    try {
      await exec("node", ["-c", join(ROOT, script)]);
      ok(script);
    } catch (err) {
      fail(script, err.stderr?.trim());
    }
  }
}

// ─── 2. tokens.json のテストデータ作成 (なければ) ─────────

async function ensureTestData() {
  console.log("\n--- Test Data ---\n");

  await mkdir(DESIGN_DIR, { recursive: true });

  const tokensPath = join(DESIGN_DIR, "tokens.json");
  const structurePath = join(DESIGN_DIR, "structure.json");

  let hasTokens = false;
  try {
    await access(tokensPath);
    hasTokens = true;
  } catch {}

  if (!hasTokens) {
    const testTokens = {
      _generated: new Date().toISOString(),
      _source: "test",
      _note: "Test data for validation",
      color: {
        extracted: [
          { color: "#ffffff", count: 50 },
          { color: "#333333", count: 30 },
          { color: "#1d7ab3", count: 20 },
        ],
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
        extracted: ["sans-serif", "monospace"],
        family: {
          base: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
        },
      },
      fontSize: {
        extracted: [
          { size: "14px", count: 20 },
          { size: "12px", count: 15 },
          { size: "16px", count: 10 },
        ],
        semantic: { xs: "11px", sm: "12px", base: "14px", md: "15px", lg: "18px" },
      },
      spacing: {
        extracted: [
          { value: "0", count: 30 },
          { value: "8px", count: 20 },
        ],
      },
      breakpoint: { sm: "768px", md: "1100px" },
      borderRadius: { sm: "3px", md: "6px" },
    };
    await writeFile(tokensPath, JSON.stringify(testTokens, null, 2));
    ok("tokens.json (created test data)");
  } else {
    ok("tokens.json (exists)");
  }

  let hasStructure = false;
  try {
    await access(structurePath);
    hasStructure = true;
  } catch {}

  if (!hasStructure) {
    const testStructure = {
      top: {
        header: null,
        categories: [
          { text: "総合", href: "/" },
          { text: "テクノロジー", href: "/hotentry/it" },
        ],
        entries: [
          {
            tag: "DIV",
            classes: ["entry-card"],
            title: "Test Entry Title",
            href: "https://example.com",
            bookmarkCount: "42",
            childTags: ["A", "SPAN"],
          },
        ],
        sidebar: null,
        footer: null,
      },
    };
    await writeFile(structurePath, JSON.stringify(testStructure, null, 2));
    ok("structure.json (created test data)");
  } else {
    ok("structure.json (exists)");
  }
}

// ─── 3. extract-hatena-design.mjs (dry run) ─────────────

async function testExtract() {
  console.log("\n--- extract-hatena-design.mjs ---\n");

  // --archive モードで実行 (ネットワークエラーは許容、クラッシュは不可)
  let output = "";
  let exitCode = 0;
  try {
    const { stdout, stderr } = await exec(
      "node",
      [join(ROOT, "scripts/extract-hatena-design.mjs"), "--archive"],
      { timeout: 60000, cwd: ROOT }
    );
    output = stdout + stderr;
  } catch (err) {
    // execFile rejects on non-zero exit OR if stderr has output
    output = (err.stdout || "") + (err.stderr || "");
    exitCode = err.code ?? 1;
  }

  // Fatal = スクリプト内部のクラッシュ (構文エラー、未ハンドル例外等)
  if (output.includes("SyntaxError:") || output.includes("ReferenceError:") || output.includes("TypeError:")) {
    fail("extract (archive mode) - runtime error", output.trim().split("\n").slice(0, 3).join("\n"));
  } else if (exitCode !== 0 && !output.includes("FAILED:")) {
    fail("extract (archive mode) - unexpected exit code " + exitCode, output.trim().split("\n").slice(-3).join("\n"));
  } else {
    ok("extract (archive mode) - no crash" + (output.includes("FAILED:") ? " (network errors expected)" : ""));
  }

  // tokens.json が生成されたか
  try {
    const tokens = JSON.parse(await readFile(join(DESIGN_DIR, "tokens.json"), "utf-8"));
    if (tokens._generated && tokens.color?.semantic) {
      ok("tokens.json is valid");
    } else {
      fail("tokens.json", "missing expected fields");
    }
  } catch (err) {
    fail("tokens.json", err.message);
  }

  // structure.json が生成されたか
  try {
    JSON.parse(await readFile(join(DESIGN_DIR, "structure.json"), "utf-8"));
    ok("structure.json is valid JSON");
  } catch (err) {
    fail("structure.json", err.message);
  }
}

// ─── 4. update-design-doc.mjs ────────────────────────────

async function testUpdateDoc() {
  console.log("\n--- update-design-doc.mjs ---\n");

  try {
    const { stdout, stderr } = await exec(
      "node",
      [join(ROOT, "scripts/update-design-doc.mjs")],
      { timeout: 30000, cwd: ROOT }
    );
    const output = stdout + stderr;

    if (output.includes("Fatal:")) {
      fail("update-design-doc", output.split("Fatal:")[1]?.trim());
    } else {
      ok("update-design-doc - completed without crash");
    }

    // design.md が生成されたか
    try {
      const md = await readFile(join(DESIGN_DIR, "design.md"), "utf-8");

      const checks = [
        ["has title", md.includes("# Design Reference")],
        ["has color palette section", md.includes("カラーパレット")],
        ["has typography section", md.includes("タイポグラフィ")],
        ["has HN mapping section", md.includes("HN → はてブ")],
        ["has layout section", md.includes("ページレイアウト")],
        ["has entry card section", md.includes("エントリーカード")],
        ["no template literal artifacts", !md.includes("${")],
        ["no undefined values", !md.includes("undefined")],
      ];

      for (const [label, result] of checks) {
        result ? ok(`design.md: ${label}`) : fail(`design.md: ${label}`);
      }
    } catch (err) {
      fail("design.md", err.message);
    }
  } catch (err) {
    fail("update-design-doc", err.stderr?.trim() || err.message);
  }
}

// ─── 5. computed-*.json 連携テスト ───────────────────────

async function testWithComputed() {
  console.log("\n--- computed-*.json integration ---\n");

  // テスト用 computed ファイルを作成
  const computedPath = join(DESIGN_DIR, "computed-test.json");
  const testComputed = {
    body: {
      fontFamily: "\"Hiragino Sans\", sans-serif",
      fontSize: "14px",
      color: "rgb(51, 51, 51)",
      backgroundColor: "rgb(245, 245, 245)",
      lineHeight: "22.4px",
    },
    header: {
      backgroundColor: "rgb(255, 255, 255)",
      height: "50px",
      borderBottom: "1px solid rgb(232, 232, 232)",
      padding: "0px 16px",
    },
    entryCard: null,
    entryTitle: null,
    link: { color: "rgb(29, 122, 179)", textDecoration: "none" },
  };
  await writeFile(computedPath, JSON.stringify(testComputed, null, 2));

  try {
    const { stdout, stderr } = await exec(
      "node",
      [join(ROOT, "scripts/update-design-doc.mjs")],
      { timeout: 30000, cwd: ROOT }
    );
    const output = stdout + stderr;

    if (output.includes("Fatal:")) {
      fail("update-design-doc with computed", output.split("Fatal:")[1]?.trim());
    } else {
      ok("update-design-doc with computed - completed");
    }

    // computed section が design.md に含まれるか
    const md = await readFile(join(DESIGN_DIR, "design.md"), "utf-8");
    if (md.includes("Computed Styles")) {
      ok("design.md: has Computed Styles section");
    } else {
      fail("design.md: missing Computed Styles section");
    }

    // cleanup test computed file
    const { unlink } = await import("node:fs/promises");
    await unlink(computedPath);
  } catch (err) {
    fail("computed integration", err.stderr?.trim() || err.message);
  }
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log("=== Design Pipeline Validation ===");

  await syntaxCheck();
  await ensureTestData();
  await testExtract();
  await testUpdateDoc();
  await testWithComputed();

  console.log("\n=================================");
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log("=================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Validation crashed:", err);
  process.exit(1);
});
