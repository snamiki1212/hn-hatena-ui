# CLAUDE.md

## Project Overview

hn-hatena-ui: Hacker News APIを使って、はてなブックマーク風UIを再現するWebアプリケーション。

## Terminology

| 略称 | 正式名称 | 説明 |
|------|----------|------|
| hn   | Hacker News | データソース。HN公式APIからストーリー・コメント等を取得する |
| ha   | はてなブックマーク (Hatena Bookmark) | UIの参考元。はてブのデザイン・UX・レイアウトを模倣する |

## Data Source

- HN API: https://github.com/HackerNews/API
  - Base URL: `https://hacker-news.firebaseio.com/v0/`
  - Top stories: `/topstories.json`
  - New stories: `/newstories.json`
  - Best stories: `/beststories.json`
  - Item detail: `/item/{id}.json`
  - User: `/user/{id}.json`

## Architecture

- SSG (Static Site Generator) でビルド時にHN APIからデータ取得 → 静的HTML生成
- ha風UIコンポーネントで表示
- GitHub Pages でホスティング
- 定期ビルド (GitHub Actions cron) でデータ更新
- UIデザイン: Pencil (pencil.dev) でワイヤーフレーム作成
- FW: Astro (Islands Architecture) + React (インタラクティブ Islands)
- 詳細: [ARCHITECTURE.md](ARCHITECTURE.md)

## Development Workflow

### ADR ファースト原則

**設計・選定・意思決定（「やらない」決定を含む）が必要な場合は、必ず実装前に ADR を作成する。**

```
ADR 作成 → レビュー・承認 → 実装
```

ADRが必要な例:
- ライブラリ・サービスの選定（翻訳API、UIライブラリ等）
- アーキテクチャの変更（データフロー、ファイル構成等）
- 機能の実装方針の選択（複数のアプローチがある場合）
- 「この機能は実装しない」という意思決定

小さな修正（バグ修正、軽微なスタイル変更等）はADR不要。

ADR置き場: `adr/YYYY-MM-DDTHHMMSS_{slug}/ADR.md`

ADRのフロントマター（必須）:

```yaml
---
status: Proposed | Accepted | Deprecated | Superseded
proposed-at: YYYY-MM-DD    # status: Proposed のとき必須
accepted-at: YYYY-MM-DD    # status: Accepted のとき必須
deprecated-at: YYYY-MM-DD  # status: Deprecated のとき必須
superseded-at: YYYY-MM-DD  # status: Superseded のとき必須
---
```

- `date` は使わない。必ず `{status}-at` 形式のフィールドを使う
- フィールド名は kebab-case (`proposed-at`, `accepted-at` 等)

## Commands

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run lint` - Lint実行
- `npm run test` - テスト実行

## Coding Conventions

- 言語: TypeScript
- コンポーネント命名: PascalCase (例: `HaStoryList`, `HaCommentTree`)
- プレフィックス規則:
  - `Hn` - HN APIに関連するモジュール (例: `HnClient`, `HnStory`)
  - `Ha` - はてブUI関連のコンポーネント (例: `HaHeader`, `HaEntryCard`)
- Astro ファイル使い分け:
  - `.astro` - 静的コンポーネント、ページ、レイアウト (HTML only, JS 0KB)
  - `.tsx` - インタラクティブ React Islands (`client:load`, `client:visible`, `client:idle`)
  - `.pen` - Pencil デザインファイル (Design as Code, テキストベース)
- ファイル配置:
  - `src/api/hn/` - HN API クライアント・型定義
  - `src/components/ha/{ComponentName}/` - はてブ風UIコンポーネント (コロケーション)
  - `src/layouts/` - Astro レイアウト
  - `src/pages/` - Astro ファイルベースルーティング
  - `src/types/` - 共通型定義
- コロケーション: Pencilデザイン (`.pen`) とコード (`.astro` or `.tsx`) は同一ディレクトリに配置
  - 静的例: `src/components/ha/HaHeader/HaHeader.pen` + `HaHeader.astro`
  - Island例: `src/components/ha/HaCommentSection/HaCommentSection.pen` + `HaCommentSection.tsx`
- デザインツール: [Pencil](https://www.pencil.dev/) (IDE統合型, Design as Code)
  - ベストプラクティス: [.claude/skills/pencildev-best-practice.md](.claude/skills/pencildev-best-practice.md)
