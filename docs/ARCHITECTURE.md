# Architecture

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HN API     │────▶│  Static Site Gen  │────▶│  GitHub Pages   │
│  (データ)    │     │  (ビルド・生成)    │     │  (ホスティング)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  ha風 UI    │
                    │  Components │
                    └─────────────┘
```

## Layer構成

### 1. Data Layer — HN API

- Hacker News Firebase API からストーリー・コメントを取得
- Base URL: `https://hacker-news.firebaseio.com/v0/`
- ビルド時にデータをfetch → 静的HTMLとして生成

### 2. Build Layer — Static Site Generator

コンテンツ生成を担うSSG。ビルド時にHN APIからデータ取得し、静的ページを出力する。

**候補 (要選定):**

| SSG | 特徴 | ha-ui適性 |
|-----|------|-----------|
| **Astro** | Islands Architecture、部分的hydration、複数FW混在可 | ◎ 静的メイン+部分的にインタラクティブ |
| **Next.js (Static Export)** | React、SSG対応、エコシステム豊富 | ○ Reactに統一したい場合 |
| **Vite + React/Vue** | 軽量、高速ビルド、SPA寄り | ○ シンプルなSPA構成 |
| **Eleventy (11ty)** | テンプレート駆動、JS少なめ、軽量 | ○ 最小構成を目指す場合 |
| **SvelteKit** | Svelte、SSG対応、バンドル小 | △ 学習コスト考慮 |

**選定観点:**
- GitHub Pages との相性 (静的出力のしやすさ)
- ha風UIのインタラクティブ要素の量 (コメント展開等)
- ビルド速度・DX
- コンポーネントの再利用性

### 3. UI Layer — ha風コンポーネント

はてなブックマーク風のデザインを再現するUI層。

**UIデザインツール: Pencil**
- ワイヤーフレーム・モックアップは [Pencil](https://pencil.evolus.vn/) で作成
- デザインファイルはコンポーネントと同一ディレクトリにコロケーション配置
- 例: `src/components/ha/HaHeader/HaHeader.epgz` + `HaHeader.tsx`

**主要画面:**

```
┌────────────────────────────────────────────────┐
│  Ha Header (ロゴ・ナビ・検索)                     │
├────────────────────────────────────────────────┤
│  Ha CategoryTabs (総合│テクノロジー│...)          │
├────────────────────────────────────────────────┤
│ ┌─────┐                                       │
│ │ 123 │  記事タイトル (HnStory.title)           │
│ │users│  example.com                           │
│ └─────┘  hn score: 456 | comments: 78          │
│ ┌─────┐                                       │
│ │  45 │  次の記事タイトル                        │
│ │users│  another.com                           │
│ └─────┘  hn score: 200 | comments: 30          │
│          ...                                   │
├────────────────────────────────────────────────┤
│  Ha Footer                                     │
└────────────────────────────────────────────────┘
```

**コンポーネントツリー:**

```
HaLayout
├── HaHeader
│   ├── HaLogo
│   ├── HaNav
│   └── HaSearchBar
├── HaCategoryTabs
├── HaEntryList
│   └── HaEntryCard (per story)
│       ├── HaBookmarkCount (hn score をはてブ数風に表示)
│       ├── HaEntryTitle
│       ├── HaEntryMeta (domain, time, hn user)
│       └── HaEntryTags
├── HaCommentSection (詳細ページ)
│   └── HaCommentItem (per comment)
│       ├── HaUserIcon
│       └── HaCommentBody
└── HaFooter
```

### 4. Hosting Layer — GitHub Pages

- GitHub Actions でビルド → `gh-pages` ブランチにデプロイ
- 定期ビルド (cron) でHNデータを更新

```yaml
# .github/workflows/deploy.yml (概要)
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  push:
    branches: [main]

jobs:
  build-deploy:
    steps:
      - Checkout
      - Install dependencies
      - Build (HN API fetch + Static generation)
      - Deploy to GitHub Pages
```

## Data Flow

```
1. Build trigger (push / cron schedule)
       │
2. Fetch HN API
       │  GET /topstories.json → [id, id, ...]
       │  GET /item/{id}.json  → { title, url, score, ... }
       │
3. Transform to ha model
       │  HnStory → HaEntry
       │  hn.score → ha.bookmarkCount
       │  hn.descendants → ha.commentCount
       │
4. Generate static pages
       │  / (トップ: HaEntryList)
       │  /story/{id} (詳細: HaCommentSection)
       │
5. Deploy to GitHub Pages
```

## Directory Structure (予定)

```
hn-hatena-ui/
├── docs/
│   └── ARCHITECTURE.md          # 本ファイル
├── src/
│   ├── api/hn/                  # HN APIクライアント
│   │   ├── client.ts            # fetch ロジック
│   │   └── types.ts             # HnStory, HnComment 等
│   ├── components/ha/           # はてブ風UIコンポーネント
│   │   ├── HaHeader/            #   コンポーネント単位のディレクトリ
│   │   │   ├── HaHeader.epgz    #   Pencil デザインファイル
│   │   │   ├── HaHeader.tsx     #   コンポーネント実装
│   │   │   ├── HaHeader.css     #   スタイル
│   │   │   └── index.ts         #   re-export
│   │   ├── HaEntryCard/
│   │   │   ├── HaEntryCard.epgz
│   │   │   ├── HaEntryCard.tsx
│   │   │   ├── HaEntryCard.css
│   │   │   └── index.ts
│   │   ├── HaEntryList/
│   │   ├── HaBookmarkCount/
│   │   ├── HaCommentSection/
│   │   ├── HaCommentItem/
│   │   ├── HaCategoryTabs/
│   │   ├── HaLayout/
│   │   └── HaFooter/
│   ├── layouts/                 # ページレイアウト
│   ├── pages/                   # ルーティング・ページ
│   └── styles/                  # グローバルスタイル (はてブカラー等)
├── public/                      # 静的アセット
├── .github/workflows/           # GitHub Actions
├── CLAUDE.md
├── README.md
└── package.json
```

**コロケーション原則:**
- 各コンポーネントはディレクトリ単位で管理
- Pencilデザイン (`.epgz`) とコード (`.tsx`, `.css`) を同一ディレクトリに配置
- デザインとコードの対応関係が一目で分かる
- コンポーネント削除時にデザインファイルも一緒に削除される

## TODO

- [ ] FW選定: SSG比較・PoC実施
- [ ] Pencilでワイヤーフレーム作成
- [ ] HN APIクライアント実装
- [ ] ha風UIコンポーネント実装
- [ ] GitHub Pages デプロイパイプライン構築
- [ ] 定期ビルド設定
