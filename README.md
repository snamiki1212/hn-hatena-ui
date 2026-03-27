# hn-hatena-ui

Hacker News APIのデータを、はてなブックマーク風のUIで表示するWebアプリケーション。

## Concept

- **データ**: [Hacker News API](https://github.com/HackerNews/API) から取得
- **UI**: [はてなブックマーク](https://b.hatena.ne.jp/) のデザインを再現

HNの豊富なテック系コンテンツを、はてブの見慣れたUIで快適に閲覧できる。

## Terminology

| 略称 | 意味 |
|------|------|
| `hn` | Hacker News (データソース) |
| `ha` | はてなブックマーク (UI参考元) |

## Features (予定)

- hn トップ/新着/ベストストーリー一覧をha風カードレイアウトで表示
- hn コメントをha風ブックマークコメント欄として表示
- カテゴリ別表示 (テクノロジー, エンタメ等)
- hn スコアをはてブ数風バッジで表示

## Tech Stack

- TypeScript
- React
- Vite

## Getting Started

```bash
npm install
npm run dev
```

## HN API

- Base: `https://hacker-news.firebaseio.com/v0/`
- [API Documentation](https://github.com/HackerNews/API)

## License

MIT
