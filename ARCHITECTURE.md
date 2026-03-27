# Architecture

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HN API     │────▶│  Astro (SSG)     │────▶│  GitHub Pages   │
│  (データ)    │     │  ビルド時 fetch   │     │  (ホスティング)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  ha風 UI    │
                    │  .astro     │ 静的レイアウト
                    │  .tsx       │ React Islands
                    │  .pen       │ Pencil デザイン
                    └─────────────┘
```

## Layer構成

### 1. Data Layer — HN API

- Hacker News Firebase API からストーリー・コメントを取得
- Base URL: `https://hacker-news.firebaseio.com/v0/`
- ビルド時にデータをfetch → 静的HTMLとして生成

### 2. Build Layer — Astro

[Astro](https://astro.build/) で SSG ビルド。選定詳細: [ADR-001](docs/adr/001-select-ssg-framework.md)

- **Islands Architecture**: 静的部分は `.astro`、インタラクティブ部分は React (`.tsx`) Islands
- **hydration制御**: `client:load` (即時), `client:visible` (表示時), `client:idle` (アイドル時)
- **ビルド時データ取得**: `getStaticPaths` + `fetch` で HN API からページ生成
- **出力**: 静的HTML (デフォルトJS 0KB、Islands部分のみJS配信)
- **依存**: `astro`, `@astrojs/react`, `react`, `react-dom`

**ファイル種別の使い分け:**

| ファイル | 用途 | hydration |
|----------|------|-----------|
| `.astro` | ページ、レイアウト、静的コンポーネント | なし (HTML only) |
| `.tsx`   | インタラクティブ部分 (React Islands) | `client:*` で制御 |
| `.pen`   | Pencil デザインファイル | — |

### 3. UI Layer — ha風コンポーネント

はてなブックマーク風のデザインを再現するUI層。

**UIデザインツール: Pencil**
- [Pencil](https://www.pencil.dev/) — IDE統合型のデザインツール (Design as Code)
- `.pen` 形式: テキストベースでGit差分・ブランチ運用可能
- デザインファイルはコンポーネントと同一ディレクトリにコロケーション配置
- 例: `src/components/ha/HaHeader/HaHeader.pen` + `HaHeader.tsx`

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
HaLayout.astro                          ← 静的レイアウト
├── HaHeader.astro                      ← 静的
│   ├── HaLogo.astro
│   ├── HaNav.astro
│   └── HaSearchBar.tsx [client:load]   ← React Island (入力操作)
├── HaCategoryTabs.tsx [client:load]    ← React Island (タブ切替)
├── HaEntryList.astro                   ← 静的
│   └── HaEntryCard.astro              ← 静的
│       ├── HaBookmarkCount.astro       ← 静的 (hn score をはてブ数風に表示)
│       ├── HaEntryTitle.astro
│       ├── HaEntryMeta.astro           ← 静的 (domain, time, hn user)
│       └── HaEntryTags.astro
├── HaCommentSection.tsx [client:visible] ← React Island (コメント展開)
│   └── HaCommentItem.tsx
│       ├── HaUserIcon.tsx
│       └── HaCommentBody.tsx
└── HaFooter.astro                      ← 静的
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
      - Setup Node.js
      - npm ci
      - npx astro build        # HN API fetch + 静的HTML生成
      - Deploy dist/ to GitHub Pages
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
4. Astro generate static pages
       │  src/pages/index.astro      → /index.html (HaEntryList)
       │  src/pages/story/[id].astro → /story/{id}/index.html (HaCommentSection)
       │  Islands (.tsx) は client:* で部分 hydration
       │
5. Deploy dist/ to GitHub Pages
```

## Directory Structure (予定)

```
hn-hatena-ui/
├── astro.config.mjs             # Astro設定 (@astrojs/react 等)
├── tsconfig.json
├── ARCHITECTURE.md              # 本ファイル
├── CLAUDE.md
├── README.md
├── package.json
├── docs/adr/                    # Architecture Decision Records
├── src/
│   ├── api/hn/                  # HN APIクライアント
│   │   ├── client.ts            # fetch ロジック
│   │   └── types.ts             # HnStory, HnComment 等
│   ├── components/ha/           # はてブ風UIコンポーネント (コロケーション)
│   │   ├── HaHeader/            #   静的コンポーネント
│   │   │   ├── HaHeader.pen     #   Pencil デザイン
│   │   │   └── HaHeader.astro   #   Astro (静的)
│   │   ├── HaEntryCard/
│   │   │   ├── HaEntryCard.pen
│   │   │   └── HaEntryCard.astro
│   │   ├── HaCommentSection/    #   React Island (インタラクティブ)
│   │   │   ├── HaCommentSection.pen
│   │   │   └── HaCommentSection.tsx
│   │   ├── HaCategoryTabs/
│   │   │   ├── HaCategoryTabs.pen
│   │   │   └── HaCategoryTabs.tsx
│   │   ├── HaEntryList/
│   │   ├── HaBookmarkCount/
│   │   ├── HaCommentItem/
│   │   ├── HaSearchBar/
│   │   └── HaFooter/
│   ├── layouts/
│   │   └── HaLayout.astro       # ベースレイアウト
│   ├── pages/                   # Astro ファイルベースルーティング
│   │   ├── index.astro          # / トップページ
│   │   └── story/
│   │       └── [id].astro       # /story/:id 詳細ページ
│   └── styles/                  # グローバルスタイル (はてブカラー等)
├── public/                      # 静的アセット (favicon等)
└── .github/workflows/
    └── deploy.yml               # GitHub Pages デプロイ
```

**コロケーション原則:**
- 各コンポーネントはディレクトリ単位で管理
- Pencilデザイン (`.pen`) とコード (`.tsx`, `.css`) を同一ディレクトリに配置 — `.pen` はテキスト形式なのでGit管理に最適
- デザインとコードの対応関係が一目で分かる
- コンポーネント削除時にデザインファイルも一緒に削除される

## TODO

- [x] FW選定: Astro 採用 ([ADR-001](docs/adr/001-select-ssg-framework.md))
- [ ] Astro プロジェクト初期セットアップ (`astro.config.mjs`, `@astrojs/react`)
- [ ] Pencilでワイヤーフレーム作成
- [ ] HN APIクライアント実装
- [ ] ha風UIコンポーネント実装 (`.astro` 静的 + `.tsx` Islands)
- [ ] GitHub Pages デプロイパイプライン構築
- [ ] 定期ビルド設定 (GitHub Actions cron)
