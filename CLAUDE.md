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

- フロントエンドSPA
- HN APIからデータ取得 → ha風UIで表示

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
  - `src/components/ha/` - はてブ風UIコンポーネント
  - `src/types/` - 共通型定義
