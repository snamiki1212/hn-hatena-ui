---
status: Accepted
accepted-at: 2026-03-27
---

# ADR-001: SSGフレームワークの選定

## Context

hn-hatena-ui は HN API からビルド時にデータを取得し、はてなブックマーク風UIの静的サイトを GitHub Pages でホスティングするプロジェクト。以下の要件を満たすSSGフレームワークを選定する必要がある。

### 要件

| # | 要件 | 重要度 |
|---|------|--------|
| R1 | SSG: ビルド時に HN API fetch → 静的HTML出力 | 必須 |
| R2 | GitHub Pages デプロイが容易 | 必須 |
| R3 | TypeScript サポート | 必須 |
| R4 | 部分的インタラクティブ (コメント展開、タブ切替等) | 必須 |
| R5 | Pencil (pencil.dev) との相性 (React等のコンポーネント) | 重要 |
| R6 | ビルド速度 | 重要 |
| R7 | バンドルサイズの小ささ | 望ましい |
| R8 | エコシステム・コミュニティ | 望ましい |

## Candidates

### 1. Astro

- **SSG**: ネイティブ対応。`getStaticPaths` + `fetch` でビルド時データ取得が自然
- **GitHub Pages**: 公式アダプタ (`@astrojs/node` 不要、デフォルトで静的出力) + 公式デプロイガイドあり
- **TypeScript**: ファーストクラスサポート
- **部分hydration**: Islands Architecture — `client:load`, `client:idle`, `client:visible` で必要な箇所だけhydrate
- **Pencil連携**: React/Vue/Svelte コンポーネントをそのまま使える → Pencil (React対応) との相性良好
- **ビルド速度**: Viteベース、高速
- **バンドルサイズ**: デフォルトでJS 0KB。Islands部分のみJSが送られる
- **コミュニティ**: GitHub ★50k+、活発なメンテナンス、v5.x (2025-2026)

### 2. Next.js (Static Export)

- **SSG**: `output: 'export'` で静的出力可能
- **GitHub Pages**: 対応可能だが、設定に手間 (`basePath`, `trailingSlash` 等)
- **TypeScript**: ファーストクラスサポート
- **部分hydration**: なし。ページ全体をhydrateする (React標準動作)
- **Pencil連携**: React なので相性良好
- **ビルド速度**: やや遅め (Turbopackで改善中)
- **バンドルサイズ**: React runtime が常に含まれる (~140KB+)
- **コミュニティ**: GitHub ★130k+、最大級のエコシステム

**懸念**: 本プロジェクトは静的コンテンツが主体。全ページhydrateはオーバーキル。SSRの恩恵を受けにくい。

### 3. Vite + React (SPA)

- **SSG**: プラグイン (`vite-plugin-ssr`, `vite-ssg`) で対応可能だが、本来SPAツール
- **GitHub Pages**: SPA fallback設定が必要 (404.html → index.html)
- **TypeScript**: Vite がネイティブ対応
- **部分hydration**: なし。完全SPA
- **Pencil連携**: React なので相性良好
- **ビルド速度**: 高速
- **バンドルサイズ**: React runtime + 全JSバンドル
- **コミュニティ**: Vite ★70k+

**懸念**: SSG が本来の用途ではない。定期cronビルドで静的ページ生成するワークフローと合わない。

### 4. Eleventy (11ty)

- **SSG**: ネイティブSSG。テンプレート駆動
- **GitHub Pages**: 非常に相性良い (純粋な静的出力)
- **TypeScript**: 直接のTS対応は弱い。別途ビルドパイプ必要
- **部分hydration**: なし。JS少ない思想。インタラクティブ要素はバニラJS or Alpineで対応
- **Pencil連携**: React コンポーネントとの統合が面倒
- **ビルド速度**: 非常に高速
- **バンドルサイズ**: 最小 (JSをほぼ出力しない)
- **コミュニティ**: GitHub ★17k+

**懸念**: コンポーネントモデルがない。ha風UIの複雑なコンポーネント群 (コメントツリー等) をテンプレートで実装するのは辛い。Pencilとの連携も弱い。

### 5. SvelteKit

- **SSG**: `adapter-static` でSSG対応
- **GitHub Pages**: 対応可能
- **TypeScript**: サポートあり
- **部分hydration**: なし (Svelte 5 で部分的に改善中)
- **Pencil連携**: Pencil は主にReact向け。Svelteコンポーネントの対応は不明
- **ビルド速度**: 高速、バンドル小
- **バンドルサイズ**: 小 (コンパイラがランタイムを除去)
- **コミュニティ**: GitHub ★20k+

**懸念**: Pencil (pencil.dev) のSvelte対応が不透明。学習コストもある。

## Comparison Matrix

| 観点 | Astro | Next.js | Vite+React | 11ty | SvelteKit |
|------|-------|---------|------------|------|-----------|
| R1 SSG | ◎ | ○ | △ | ◎ | ○ |
| R2 GH Pages | ◎ | ○ | △ | ◎ | ○ |
| R3 TypeScript | ◎ | ◎ | ◎ | △ | ○ |
| R4 部分hydration | ◎ | × | × | △ | △ |
| R5 Pencil連携 | ◎ | ◎ | ◎ | × | △ |
| R6 ビルド速度 | ◎ | △ | ◎ | ◎ | ◎ |
| R7 バンドルサイズ | ◎ | △ | △ | ◎ | ◎ |
| R8 エコシステム | ◎ | ◎ | ◎ | ○ | ○ |

## Decision

**Astro を採用する。**

### 理由

1. **Islands Architecture が最適解**: このプロジェクトは9割が静的コンテンツ (記事一覧) で、1割がインタラクティブ (コメント展開、タブ切替)。Astro の部分hydration はこのユースケースにぴったり
2. **JS 0KB デフォルト**: 静的部分はJSゼロで配信。GitHub Pages の高速表示に寄与
3. **FW非依存**: React コンポーネントを `client:load` で使える → Pencil (pencil.dev) でデザインした React コンポーネントをそのまま持ち込める
4. **SSG + GitHub Pages が一級サポート**: 設定不要でビルド → デプロイ可能
5. **ビルド時 data fetch**: Content Collections や `getStaticPaths` で HN API からのビルド時データ取得が自然に書ける

### UIコンポーネントのFW

Astro 内のインタラクティブコンポーネント (Islands) は **React** で実装する。

- Pencil (pencil.dev) が React と相性良い
- エコシステムが最大 → UI ライブラリの選択肢が豊富

## Consequences

- Astro の学習コストが発生するが、基本的なSSGとしては直感的
- React コンポーネントを `@astrojs/react` 経由で統合する設定が必要
- `.astro` ファイル (静的レイアウト) と `.tsx` ファイル (インタラクティブ Islands) を使い分ける必要がある
- 将来的にSSR が必要になった場合も、Astro は SSR モードへの移行が容易
