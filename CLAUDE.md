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
- UIデザイン: Pencil でワイヤーフレーム作成
- FW: 選定中 (Astro, Next.js Static Export, Vite+React, 11ty, SvelteKit が候補)
- 詳細: [ARCHITECTURE.md](ARCHITECTURE.md)

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
- ファイル配置:
  - `src/api/hn/` - HN API クライアント・型定義
  - `src/components/ha/{ComponentName}/` - はてブ風UIコンポーネント (コロケーション)
  - `src/types/` - 共通型定義
- コロケーション: Pencilデザイン (`.pen`) とコード (`.tsx`, `.css`) は同一ディレクトリに配置
  - 例: `src/components/ha/HaHeader/HaHeader.pen` + `HaHeader.tsx` + `HaHeader.css` + `index.ts`
- デザインツール: [Pencil](https://www.pencil.dev/) (IDE統合型, Design as Code, テキストベース `.pen` 形式)
