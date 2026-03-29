---
title: Pencil.dev Best Practice
description: Pencil.dev (.pen) ファイルの作成・編集時に参照するナレッジベース。フォーマット仕様、レイアウト、変数、コンポーネント設計、MCP連携のベストプラクティス。
match:
  - "**/*.pen"
  - "pencil"
  - "デザイン"
  - ".pen"
---

# Pencil.dev Best Practice Guide

このスキルは Pencil.dev (.pen) ファイルの作成・編集時に参照するナレッジベースです。

## .pen ファイルフォーマット

### ドキュメント構造

```json
{
  "version": "2.9",
  "themes": { "mode": ["light", "dark"] },
  "imports": { "tokens": "../styles/tokens.pen" },
  "variables": { ... },
  "children": [ ... ]
}
```

- `version`: 現在の最新は `"2.9"`
- `imports`: 他の .pen からの変数・コンポーネント読み込み。パスは相対パス
- `variables`: デザイントークン定義
- `children`: キャンバス上のオブジェクト配列

### オブジェクト型一覧

```
Child = Frame | Group | Rectangle | Ellipse | Line | Path | Polygon
      | Text | Note | Prompt | Context | IconFont | Ref
```

### 共通プロパティ (Entity)

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | YES | ドキュメント内で一意 |
| `type` | string | YES | オブジェクト型 |
| `name` | string | - | 人間が読める名前 |
| `x`, `y` | number | - | 位置 (親が flexbox の場合は無視される) |
| `width`, `height` | number | - | サイズ |
| `opacity` | NumberOrVariable | - | 透明度 |
| `reusable` | boolean | - | `true` でコンポーネント化 |
| `enabled` | boolean | - | 表示/非表示 |

---

## レイアウトシステム (Flexbox)

Frame に `layout` を設定すると flexbox レイアウトになる。

| プロパティ | 値 | 説明 |
|---|---|---|
| `layout` | `"vertical"` / `"horizontal"` | flex direction |
| `justifyContent` | `"start"` / `"center"` / `"end"` / `"space_between"` / `"space_around"` / `"space_evenly"` | 主軸方向の配置 |
| `alignItems` | `"start"` / `"center"` / `"end"` / `"baseline"` / `"stretch"` | 交差軸方向の配置 |
| `gap` | number | 子要素間のスペース |
| `padding` | `[top, right, bottom, left]` or `[tb, rl]` or `[all]` | 内側の余白 |
| `sizingBehavior` | `"fill_container"` | 子が親の空きを埋める (flex-grow: 1) |
| `clip` | boolean | overflow: hidden |

**重要**: 親が `layout` を持つ場合、子の `x`, `y` は無視される。

### Tailwind へのマッピング

| .pen | Tailwind |
|---|---|
| `layout: "horizontal"` | `flex flex-row` |
| `layout: "vertical"` | `flex flex-col` |
| `gap: 16` | `gap-4` |
| `padding: [16, 24]` | `py-4 px-6` |
| `alignItems: "center"` | `items-center` |
| `justifyContent: "space_between"` | `justify-between` |
| `sizingBehavior: "fill_container"` | `flex-1` |

---

## Fill (塗り)

文字列で指定。複数塗りが必要な場合は配列。

### Solid Color

```json
"fill": "#1d7ab3"
```

### 変数参照

```json
"fill": "$hatena-blue"
```

### 複数 Fill (配列)

```json
"fill": ["#ffffff", "$overlay-color"]
```

### ブレンドモード

`"normal"`, `"darken"`, `"multiply"`, `"linearBurn"`, `"colorBurn"`, `"light"`, `"screen"`, `"linearDodge"`, `"colorDodge"`, `"overlay"`, `"softLight"`, `"hardLight"`, `"difference"`, `"exclusion"`, `"hue"`, `"saturation"`, `"color"`, `"luminosity"`

---

## Stroke (枠線)

```json
"stroke": {
  "fill": "$border",
  "thickness": 1
}
```

| プロパティ | 値 |
|---|---|
| `align` | `"inside"` / `"center"` / `"outside"` |
| `thickness` | number または `{ top, right, bottom, left }` |
| `join` | `"miter"` / `"bevel"` / `"round"` |
| `cap` | `"none"` / `"round"` / `"square"` |
| `dash` | `number[]` (破線パターン) |

---

## Effects (エフェクト)

```json
"effects": [
  { "type": "drop_shadow", "x": 0, "y": 2, "blur": 4, "spread": 0, "color": "rgba(0,0,0,0.1)" },
  { "type": "blur", "radius": 4 },
  { "type": "background_blur", "radius": 8 }
]
```

---

## Corner Radius

```json
"cornerRadius": 6
```

4隅個別:

```json
"cornerRadius": [8, 8, 0, 0]
```

`[topLeft, topRight, bottomRight, bottomLeft]` の順。

---

## Typography (Text)

### TextStyle プロパティ

| プロパティ | 型 | 説明 |
|---|---|---|
| `text` | StringOrVariable / TextStyle[] | テキスト内容。配列でリッチテキスト |
| `fontFamily` | StringOrVariable | フォントファミリー |
| `fontSize` | NumberOrVariable | フォントサイズ (px) |
| `fontWeight` | StringOrVariable | `"bold"` 等 |
| `fontStyle` | StringOrVariable | `"italic"` 等 |
| `letterSpacing` | NumberOrVariable | 字間 |
| `lineHeight` | NumberOrVariable | 行の高さ (font-size の倍数) |
| `textAlign` | string | `"left"` / `"center"` / `"right"` / `"justify"` |
| `textAlignVertical` | string | `"top"` / `"middle"` / `"bottom"` |
| `underline` | BooleanOrVariable | 下線 |
| `strikethrough` | BooleanOrVariable | 取消線 |
| `href` | string | リンク先 URL |

### textGrowth (テキストボックスの挙動)

| 値 | 動作 |
|---|---|
| `"auto"` | ボックスがテキストに合わせて拡大。折り返しなし |
| `"fixed-width"` | 幅固定、高さが伸びる。テキスト折り返しあり |
| `"fixed-width-height"` | 幅・高さ固定。はみ出す可能性あり |

**ルール**: `width`/`height` を設定した text には必ず `textGrowth` も設定する。

---

## Variables (デザイントークン)

### 定義

```json
"variables": {
  "primary-color": { "type": "color", "value": "#1d7ab3" },
  "font-base": { "type": "number", "value": 14 },
  "is-dark": { "type": "boolean", "value": false },
  "app-name": { "type": "string", "value": "HN Hatena" }
}
```

### 4つの型

- `boolean` - true/false
- `color` - カラー値 (#hex, rgba())
- `number` - 数値 (px サイズ、スペーシング等)
- `string` - テキスト

### 参照方法

`$variable-name` プレフィックスで参照:

```json
"fill": [{ "type": "solid", "color": "$primary-color" }],
"fontSize": "$font-base"
```

### テーマ対応

```json
"themes": { "mode": ["light", "dark"] },
"variables": {
  "bg": {
    "type": "color",
    "value": "#ffffff",
    "themeValues": { "mode:dark": "#1a1a1a" }
  }
}
```

Frame に `"theme": { "mode": "dark" }` を設定すると子要素がダークモード値を使う。

---

## コンポーネントと再利用

### コンポーネント定義

```json
{
  "id": "entry-card",
  "type": "frame",
  "reusable": true,
  ...
}
```

### インスタンス (ref)

```json
{
  "id": "card-instance-1",
  "type": "ref",
  "refId": "entry-card",
  "overrides": {
    "entry-title": { "content": "記事タイトル" }
  }
}
```

### Override ルール

- 変更するプロパティだけ指定する
- `id`, `type`, `children` は override 不可
- ネストした子要素は `id` をキーにして override する

### Slots

コンポーネント内にスロットを定義して、インスタンスで中身を差し替え可能にする:

```json
{
  "id": "content-area",
  "type": "frame",
  "slot": ["recommended-component-id-1", "recommended-component-id-2"]
}
```

---

## Import システム

### 基本形 (配列)

```json
"imports": ["../styles/tokens.pen", "../HaEntryCard/HaEntryCard.pen"]
```

### エイリアス形式 (オブジェクト)

```json
"imports": {
  "tokens": "../styles/tokens.pen",
  "cards": "../HaEntryCard/HaEntryCard.pen"
}
```

- パスは現在の .pen ファイルからの相対パス
- import した .pen の variables と reusable コンポーネントが利用可能になる

---

## MCP 連携 (Pencil + Claude Code)

### 前提条件

- Pencil を Claude Code より先に開くこと (MCP 接続確立のため)
- `/mcp` コマンドで接続確認

### 主要ツール

| ツール | 用途 |
|---|---|
| `batch_design` | 要素の作成/変更/削除 (最大25操作/呼出) |
| `batch_get` | コンポーネント情報の取得 |
| `get_screenshot` | デザインプレビューの描画 |
| `snapshot_layout` | レイアウト構造分析。`problemsOnly: true` でQA |
| `get_variables` | デザイントークンの読み取り |
| `set_variables` | デザイントークンの更新 |
| `get_editor_state` | エディタの現在状態 |
| `get_guidelines` | デザインガイドライン取得 |

### 推奨ワークフロー

1. `get_editor_state` → 現在の状態を把握
2. `batch_get` → 既存の再利用コンポーネントを確認
3. `get_variables` → デザイントークンを確認
4. `get_guidelines` → デザインルールを確認
5. `batch_design` → デザインを構築
6. `get_screenshot` → ビジュアル確認
7. `snapshot_layout` → レイアウト問題の検出

---

## エクスポート

### 対応フォーマット

- React + TypeScript + Tailwind CSS (推奨)
- Vue
- Plain HTML
- PNG / JPG / WEBP / SVG

### Design-to-Code マッピング

| .pen | HTML/React 出力 |
|---|---|
| `frame` (layout あり) | `<div className="flex ...">` |
| `text` | `<p>`, `<h1-6>`, `<span>` |
| `ref` | 再利用 React コンポーネント |
| `rectangle` | `<div>` with fill |
| `ellipse` | `<div className="rounded-full">` |

---

## ベストプラクティス

### ファイル管理

1. **コロケーション**: `.pen` はコード (.astro/.tsx) と同じディレクトリに配置する
   ```
   src/components/ha/HaHeader/
   ├── HaHeader.pen    ← デザイン
   ├── HaHeader.astro  ← 実装
   ```
2. **Git 管理**: .pen はテキスト(JSON)なので diff が見える。コードと同様にコミットする
3. **頻繁に保存**: Pencil は自動保存なし。こまめに保存＆コミット

### デザイントークン

4. **値のハードコード禁止**: 色、スペーシング、radius、フォントサイズは必ず `$variable` を使う
5. **トークン集約**: `src/styles/tokens.pen` に一元化して各コンポーネントから import
6. **テーマ対応**: light/dark は変数の `themeValues` で対応する

### コンポーネント設計

7. **早期にコンポーネント化**: ボタン、カード、バッジ等は `reusable: true` で定義
8. **既存コンポーネントは必ず再利用**: 同じ見た目を作る場合、コピーせず `ref` で参照する
9. **Slot を活用**: コンテナ型コンポーネントは slot でカスタマイズポイントを明示する
10. **Override は最小限**: 変更するプロパティだけ override する

### テキスト

11. **textGrowth を忘れない**: `width`/`height` を設定した text には必ず `textGrowth` を指定
12. **リッチテキスト**: `content` を TextStyle 配列にすれば部分的にスタイル変更可能

### レイアウト

13. **Flexbox を活用**: 手動 x/y 配置より `layout` + `gap` + `padding` を優先
14. **fill_container**: 可変幅の要素には `sizingBehavior: "fill_container"` を使う
15. **stroke align**: ボーダーは `"inside"` を推奨 (レイアウト計算に影響しない)

### AI 連携

16. **MCP 起動順序**: Pencil → Claude Code の順で起動する
17. **snapshot_layout でQA**: デザイン完成後に `problemsOnly: true` で問題検出
18. **get_screenshot で確認**: コード生成前に必ずビジュアルプレビューを確認

---

## このプロジェクトでの規約

- トークンファイル: `src/styles/tokens.pen`
- コンポーネント配置: `src/components/ha/{Name}/{Name}.pen`
- レイアウト配置: `src/layouts/{Name}.pen`
- プレフィックス: `Ha` (はてブ風UI)
- import パスは相対パス
- `version` はプロジェクト全体で統一する
