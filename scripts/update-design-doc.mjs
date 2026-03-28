#!/usr/bin/env node

/**
 * tokens.json + structure.json の内容を design.md に反映するスクリプト
 *
 * - tokens.json の extracted / semantic 値で design.md のカラー・フォント等を更新
 * - structure.json のカテゴリ・エントリー構造を反映
 * - design.md のレイアウト図やHNマッピング等の手書きセクションは保持
 *
 * Usage:
 *   node scripts/update-design-doc.mjs
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DESIGN_DIR = join(ROOT, "docs", "design");
const TOKENS_PATH = join(DESIGN_DIR, "tokens.json");
const STRUCTURE_PATH = join(DESIGN_DIR, "structure.json");
const DESIGN_MD_PATH = join(DESIGN_DIR, "design.md");

async function loadJSON(path) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

function formatDate(iso) {
  if (!iso) return "unknown";
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function generateDesignMd(tokens, structure, computed) {
  const sem = tokens?.color?.semantic || {};
  const fontSem = tokens?.fontSize?.semantic || {};
  const fontFamily =
    tokens?.font?.family?.base ||
    '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
  const bp = tokens?.breakpoint || {};
  const br = tokens?.borderRadius || {};

  // structure から検出したカテゴリ
  const categories = structure?.top?.categories || structure?.["hotentry-all"]?.categories || [];
  // サンプルエントリー
  const sampleEntries = structure?.["hotentry-it"]?.entries || structure?.top?.entries || [];

  // 抽出された色 top10
  const extractedColors = (tokens?.color?.extracted || []).slice(0, 10);
  // 抽出されたフォントサイズ
  const extractedSizes = (tokens?.fontSize?.extracted || []).slice(0, 10);

  // computed styles (Puppeteer で取得した実測値)
  const hasComputed = Object.keys(computed).length > 0;
  // 代表的な computed を取得 (hotentry-it > top > any)
  const comp = computed["hotentry-it"] || computed["top"] || Object.values(computed)[0] || {};

  return `# Design Reference: はてなブックマーク (Hatena Bookmark)

参照元: \`https://b.hatena.ne.jp/\`
最終抽出: ${formatDate(tokens?._generated)}
ソース: ${tokens?._source || "N/A"}

> このドキュメントは、はてなブックマークのUIデザインを参考にした設計資料です。
> 実装は模倣であり、コードやアセットのコピーではありません。
> **このファイルは \`npm run update-design-doc\` で自動生成されます。手動編集は上書きされます。**

---

## 1. ページレイアウト

\`\`\`
┌─────────────────────────────────────────────────┐
│ Header (グローバルナビ)                           │
├─────────────────────────────────────────────────┤
│ Category Tabs (カテゴリタブ)                      │
├───────────────────────────────┬─────────────────┤
│                               │                 │
│  Main Content                 │  Sidebar        │
│  (エントリーリスト)             │  (ランキング等)   │
│                               │                 │
├───────────────────────────────┴─────────────────┤
│ Footer                                          │
└─────────────────────────────────────────────────┘
\`\`\`

- **全体幅**: 最大 \`${bp.md || "1100px"}\` 程度、中央寄せ
- **メインコンテンツ**: 約 70%
- **サイドバー**: 約 30%
- **背景色**: \`${sem["bg-secondary"] || "#f5f5f5"}\`

---

## 2. ヘッダー (Header)

\`\`\`
┌─────────────────────────────────────────────────┐
│ [B!ロゴ]  [検索バー          ]  [ログイン] [新規] │
├─────────────────────────────────────────────────┤
│ 総合 | テクノロジー | エンタメ | アニメ | ...     │
└─────────────────────────────────────────────────┘
\`\`\`

### 構造
- **上段**: ロゴ + 検索バー + ユーザーアクション
- **下段**: カテゴリタブ (横スクロール可)

### デザイン
- ヘッダー背景: \`${sem["bg-primary"] || "#ffffff"}\`
- 下ボーダー: \`1px solid ${sem["border"] || "#e8e8e8"}\`
- ロゴ: 「B!」マーク (青色アイコン + テキスト)
- 検索バー: 角丸、グレーボーダー、幅広
- 高さ: 上段 約 \`50px\`、下段 約 \`40px\`

---

## 3. カテゴリタブ (Category Tabs)

### カテゴリ一覧 (サイトから検出)
${
  categories.length > 0
    ? "| カテゴリ | リンク |\n|---|---|\n" +
      categories
        .slice(0, 15)
        .map((c) => `| ${c.text} | \`${c.href}\` |`)
        .join("\n")
    : "| カテゴリ | 対応HNマッピング |\n|---|---|\n| 総合 | topstories |\n| テクノロジー | topstories (tech filter) |\n| エンタメ | - |\n| アニメとゲーム | - |\n| おもしろ | - |\n| 暮らし | - |\n| 政治と経済 | - |\n| 学び | - |\n| 世の中 | - |"
}

> 本プロジェクトでは HN API のカテゴリ (top/new/best) に読み替える

### デザイン
- タブスタイル: テキストのみ、アクティブタブに下線
- アクティブ色: \`${sem["hatena-blue"] || "#1d7ab3"}\`
- 非アクティブ色: \`${sem["text-secondary"] || "#666666"}\`
- フォントサイズ: \`${fontSem["sm"] || "13px"}\`
- タブ間余白: \`16px\`

---

## 4. エントリーカード (Entry Card)

\`\`\`
┌─────────────────────────────────────────────────┐
│ ┌──────┐                                        │
│ │ thumb│ タイトルテキスト (リンク)                  │
│ │  img │ example.com                             │
│ └──────┘                                        │
│           [Author]  [3時間前]  [45 comments]      │
│                                    [B! 128 users]│
└─────────────────────────────────────────────────┘
\`\`\`

### 構造
1. **サムネイル** (左側、正方形 \`80x80\` 程度)
2. **タイトル** (リンク、太字)
3. **ドメイン名** (小さいグレーテキスト)
4. **メタ情報行**: 投稿者、時刻、コメント数
5. **ブックマーク数バッジ** (右下、目立つ配色)

### デザイン
- カード背景: \`${sem["bg-primary"] || "#ffffff"}\`
- ボーダー: \`1px solid ${sem["border"] || "#e8e8e8"}\`
- カード間マージン: \`0\` (ボーダーで区切り、リストスタイル)
- パディング: \`12px 16px\`
- タイトル:
  - 色: \`${sem["text-primary"] || "#333333"}\`
  - フォントサイズ: \`${fontSem["md"] || "15px"}\`
  - フォントウェイト: \`bold\`
  - ホバー時: \`${sem["hatena-blue"] || "#1d7ab3"}\`
- ドメイン:
  - 色: \`${sem["text-muted"] || "#999999"}\`
  - フォントサイズ: \`${fontSem["sm"] || "12px"}\`
- メタ情報:
  - 色: \`${sem["text-muted"] || "#999999"}\`
  - フォントサイズ: \`${fontSem["sm"] || "12px"}\`
${
  sampleEntries.length > 0
    ? `
### 検出されたエントリー構造 (サンプル)
\`\`\`json
${JSON.stringify(sampleEntries[0], null, 2)}
\`\`\`
`
    : ""
}
---

## 5. ブックマーク数バッジ (Bookmark Count Badge)

はてブの最も特徴的なUI要素。

### バリエーション (ブクマ数に応じた色分け)
| ブクマ数 | 背景色 | テキスト色 | 意味 |
|---|---|---|---|
| 1-9 | \`${sem["bookmark-cold"] || "#f0f0f0"}\` | \`${sem["text-secondary"] || "#666666"}\` | 少なめ |
| 10-49 | \`#fff2e0\` | \`${sem["bookmark-warm"] || "#ff9900"}\` | やや話題 |
| 50-99 | \`#ffe0e0\` | \`${sem["bookmark-hot"] || "#ff6666"}\` | 話題 |
| 100-499 | \`${sem["bookmark-hot"] || "#ff6666"}\` | \`#ffffff\` | 人気 |
| 500+ | \`${sem["bookmark-fire"] || "#ff3333"}\` | \`#ffffff\` | 大人気 (炎上含む) |

> 本プロジェクトでは HN の score (ポイント) をこの段階に読み替える

### デザイン
- 形状: 角丸 (\`border-radius: ${br.sm || "3px"}\`)
- パディング: \`2px 6px\`
- フォントサイズ: \`${fontSem["xs"] || "11px"}\`
- フォントウェイト: \`bold\`
- テキスト: \`{数値} users\`

---

## 6. サイドバー (Sidebar)

### 含まれる要素
1. **人気エントリーランキング** (1-10位)
2. **カテゴリ別リンク**
3. **広告枠** (本プロジェクトでは不要)

### デザイン
- 背景: \`${sem["bg-primary"] || "#ffffff"}\`
- ボーダー: \`1px solid ${sem["border"] || "#e8e8e8"}\`
- セクション見出し:
  - フォントサイズ: \`${fontSem["base"] || "14px"}\`
  - フォントウェイト: \`bold\`
  - 背景: \`${sem["bg-secondary"] || "#f5f5f5"}\`
  - パディング: \`8px 12px\`

---

## 7. カラーパレット

### Semantic (プロジェクト定義)

#### Primary
| 名前 | 値 | 用途 |
|---|---|---|
| hatena-blue | \`${sem["hatena-blue"] || "#1d7ab3"}\` | ブランドカラー、リンク、アクティブタブ |
| hatena-blue-hover | \`${sem["hatena-blue-hover"] || "#166a9e"}\` | ホバー時 |

#### Neutral
| 名前 | 値 | 用途 |
|---|---|---|
| bg-primary | \`${sem["bg-primary"] || "#ffffff"}\` | カード背景、ヘッダー背景 |
| bg-secondary | \`${sem["bg-secondary"] || "#f5f5f5"}\` | ページ背景 |
| border | \`${sem["border"] || "#e8e8e8"}\` | カード・セクションの区切り |
| text-primary | \`${sem["text-primary"] || "#333333"}\` | メインテキスト |
| text-secondary | \`${sem["text-secondary"] || "#666666"}\` | サブテキスト |
| text-muted | \`${sem["text-muted"] || "#999999"}\` | メタ情報、ドメイン |

#### Accent (ブックマーク数)
| 名前 | 値 | 用途 |
|---|---|---|
| bookmark-cold | \`${sem["bookmark-cold"] || "#f0f0f0"}\` | 少ブクマ |
| bookmark-warm | \`${sem["bookmark-warm"] || "#ff9900"}\` | 中ブクマ |
| bookmark-hot | \`${sem["bookmark-hot"] || "#ff6666"}\` | 多ブクマ |
| bookmark-fire | \`${sem["bookmark-fire"] || "#ff3333"}\` | 超人気 |

### Extracted (サイトから自動抽出、出現頻度順)
${
  extractedColors.length > 0
    ? "| 色 | 出現数 |\n|---|---|\n" +
      extractedColors.map((c) => `| \`${c.color}\` | ${c.count} |`).join("\n")
    : "_抽出データなし。\`npm run extract-design\` を実行してください。_"
}

---

## 8. タイポグラフィ

### フォントファミリー
\`\`\`css
font-family: ${fontFamily};
\`\`\`
${
  (tokens?.font?.extracted || []).length > 0
    ? "\n### サイトから検出されたフォント\n" +
      tokens.font.extracted.map((f) => `- \`${f}\``).join("\n")
    : ""
}

### サイズ一覧
| 要素 | size | weight | line-height |
|---|---|---|---|
| body | \`${fontSem["base"] || "14px"}\` | \`normal\` | \`1.6\` |
| エントリータイトル | \`${fontSem["md"] || "15px"}\` | \`bold\` | \`1.4\` |
| メタ情報 | \`${fontSem["sm"] || "12px"}\` | \`normal\` | \`1.4\` |
| カテゴリタブ | \`13px\` | \`normal / bold (active)\` | \`1.0\` |
| セクション見出し | \`${fontSem["base"] || "14px"}\` | \`bold\` | \`1.4\` |
| ブクマ数バッジ | \`${fontSem["xs"] || "11px"}\` | \`bold\` | \`1.0\` |

${
  extractedSizes.length > 0
    ? "### サイトから検出されたサイズ (出現頻度順)\n| サイズ | 出現数 |\n|---|---|\n" +
      extractedSizes.map((s) => `| \`${s.size}\` | ${s.count} |`).join("\n")
    : ""
}

---

## 9. スペーシング

| 要素 | 値 |
|---|---|
| ページ左右パディング | \`16px\` |
| カード内パディング | \`12px 16px\` |
| カード間マージン | \`0\` (ボーダー区切り) |
| サムネイルとテキストの間 | \`12px\` |
| メタ情報の項目間 | \`8px\` |
| セクション間 | \`24px\` |
| ヘッダー高さ | \`50px\` (上段) + \`40px\` (下段) |

---

## 10. レスポンシブ

| ブレークポイント | レイアウト |
|---|---|
| \`>= ${bp.md || "1100px"}\` | 2カラム (メイン + サイドバー) |
| \`${bp.sm || "768px"} - ${parseInt(bp.md) - 1 || "1099"}px\` | 1カラム (サイドバー下に移動) |
| \`< ${bp.sm || "768px"}\` | 1カラム、カテゴリタブ横スクロール、サムネイル縮小 |

---

## 11. HN → はてブ マッピング

| はてブ要素 | HN対応 |
|---|---|
| ブックマーク数 (\`users\`) | score (ポイント) |
| ブックマークコメント | comments |
| カテゴリ | top / new / best stories |
| エントリーURL | story URL |
| エントリータイトル | story title |
| 投稿者 | story author (\`by\`) |
| 投稿時刻 | story time |
${
  hasComputed
    ? `
---

## 12. Computed Styles (ブラウザ実測値)

> Puppeteer の \`getComputedStyle\` で取得した実際の描画値。CSS抽出より信頼性が高い。

### body
${comp.body ? `| プロパティ | 値 |\n|---|---|\n` + Object.entries(comp.body).map(([k, v]) => `| ${k} | \`${v}\` |`).join("\n") : "_データなし_"}

### header
${comp.header ? `| プロパティ | 値 |\n|---|---|\n` + Object.entries(comp.header).map(([k, v]) => `| ${k} | \`${v}\` |`).join("\n") : "_データなし_"}

### entryCard
${comp.entryCard ? `| プロパティ | 値 |\n|---|---|\n` + Object.entries(comp.entryCard).map(([k, v]) => `| ${k} | \`${v}\` |`).join("\n") : "_データなし_"}

### entryTitle
${comp.entryTitle ? `| プロパティ | 値 |\n|---|---|\n` + Object.entries(comp.entryTitle).map(([k, v]) => `| ${k} | \`${v}\` |`).join("\n") : "_データなし_"}

### link
${comp.link ? `| プロパティ | 値 |\n|---|---|\n` + Object.entries(comp.link).map(([k, v]) => `| ${k} | \`${v}\` |`).join("\n") : "_データなし_"}

${Object.keys(computed).length > 1 ? `> 他のページの実測値: ${Object.keys(computed).filter(k => k !== (comp === computed["hotentry-it"] ? "hotentry-it" : "top")).map(k => \`computed-\${k}.json\`).join(", ")}` : ""}
`
    : ""
}
`;
}

async function loadComputedFiles() {
  const computed = {};
  try {
    const files = await readdir(DESIGN_DIR);
    for (const file of files) {
      const match = file.match(/^computed-(.+)\.json$/);
      if (match) {
        const data = await loadJSON(join(DESIGN_DIR, file));
        if (data) computed[match[1]] = data;
      }
    }
  } catch {
    // no computed files
  }
  return computed;
}

async function main() {
  console.log("  update-design-doc\n");

  const tokens = await loadJSON(TOKENS_PATH);
  const structure = await loadJSON(STRUCTURE_PATH);
  const computed = await loadComputedFiles();

  if (!tokens) {
    console.error(
      "  tokens.json not found. Run 'npm run extract-design' first."
    );
    process.exit(1);
  }

  console.log(`  tokens: ${formatDate(tokens._generated)}`);
  console.log(`  structure: ${structure ? "loaded" : "not found (using defaults)"}`);
  console.log(`  computed: ${Object.keys(computed).length} files`);

  const md = generateDesignMd(tokens, structure, computed);
  await writeFile(DESIGN_MD_PATH, md);

  console.log(`\n  saved: ${DESIGN_MD_PATH}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
