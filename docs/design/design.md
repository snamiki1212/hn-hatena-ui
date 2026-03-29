# Design Reference: はてなブックマーク (Hatena Bookmark)

参照元: `https://b.hatena.ne.jp/`
最終抽出: 2026-03-29 07:30:44 UTC
ソース: https://web.archive.org/ (via b.hatena.ne.jp)

> このドキュメントは、はてなブックマークのUIデザインを参考にした設計資料です。
> 実装は模倣であり、コードやアセットのコピーではありません。
> **このファイルは `npm run update-design-doc` で自動生成されます。手動編集は上書きされます。**

---

## 1. ページレイアウト

```
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
```

- **全体幅**: 最大 `1100px` 程度、中央寄せ
- **メインコンテンツ**: 約 70%
- **サイドバー**: 約 30%
- **背景色**: `#f5f5f5`

---

## 2. ヘッダー (Header)

```
┌─────────────────────────────────────────────────┐
│ [B!ロゴ]  [検索バー          ]  [ログイン] [新規] │
├─────────────────────────────────────────────────┤
│ 総合 | テクノロジー | エンタメ | アニメ | ...     │
└─────────────────────────────────────────────────┘
```

### 構造
- **上段**: ロゴ + 検索バー + ユーザーアクション
- **下段**: カテゴリタブ (横スクロール可)

### デザイン
- ヘッダー背景: `#ffffff`
- 下ボーダー: `1px solid #e8e8e8`
- ロゴ: 「B!」マーク (青色アイコン + テキスト)
- 検索バー: 角丸、グレーボーダー、幅広
- 高さ: 上段 約 `50px`、下段 約 `40px`

---

## 3. カテゴリタブ (Category Tabs)

### カテゴリ一覧 (サイトから検出)
| カテゴリ | リンク |
|---|---|
| 世の中 | `` |
| テクノロジー | `` |
| エンタメ | `` |
| 暮らし | `` |
| 人気エントリーをすべて読む | `` |
| 期間 | `` |
| 週間 | `` |
| 月間 | `` |
| エンジニアブログの新着エントリーをもっと読む | `` |
| はてなブログ - 注目記事の新着エントリーをもっと読む | `` |
| もっと読む | `` |
| 学び | `` |
| 企業メディアの新着エントリーをもっと読む | `` |
| 週刊はてなブログの新着エントリーをもっと読む | `` |
| 政治と経済 | `` |

> 本プロジェクトでは HN API のカテゴリ (top/new/best) に読み替える

### デザイン
- タブスタイル: テキストのみ、アクティブタブに下線
- アクティブ色: `#1d7ab3`
- 非アクティブ色: `#666666`
- フォントサイズ: `12px`
- タブ間余白: `16px`

---

## 4. エントリーカード (Entry Card)

```
┌─────────────────────────────────────────────────┐
│ ┌──────┐                                        │
│ │ thumb│ タイトルテキスト (リンク)                  │
│ │  img │ example.com                             │
│ └──────┘                                        │
│           [Author]  [3時間前]  [45 comments]      │
│                                    [B! 128 users]│
└─────────────────────────────────────────────────┘
```

### 構造
1. **サムネイル** (左側、正方形 `80x80` 程度)
2. **タイトル** (リンク、太字)
3. **ドメイン名** (小さいグレーテキスト)
4. **メタ情報行**: 投稿者、時刻、コメント数
5. **ブックマーク数バッジ** (右下、目立つ配色)

### デザイン
- カード背景: `#ffffff`
- ボーダー: `1px solid #e8e8e8`
- カード間マージン: `0` (ボーダーで区切り、リストスタイル)
- パディング: `12px 16px`
- タイトル:
  - 色: `#333333`
  - フォントサイズ: `15px`
  - フォントウェイト: `bold`
  - ホバー時: `#1d7ab3`
- ドメイン:
  - 色: `#999999`
  - フォントサイズ: `12px`
- メタ情報:
  - 色: `#999999`
  - フォントサイズ: `12px`

### 検出されたエントリー構造 (サンプル)
```json
{
  "tag": "LI",
  "classes": [
    "js-navi-category-item",
    "cat-it",
    "is-active"
  ],
  "title": "テクノロジー",
  "href": "/hotentry/it",
  "bookmarkCount": "",
  "childTags": [
    "DIV",
    "DIV"
  ]
}
```

---

## 5. ブックマーク数バッジ (Bookmark Count Badge)

はてブの最も特徴的なUI要素。

### バリエーション (ブクマ数に応じた色分け)
| ブクマ数 | 背景色 | テキスト色 | 意味 |
|---|---|---|---|
| 1-9 | `#f0f0f0` | `#666666` | 少なめ |
| 10-49 | `#fff2e0` | `#ff9900` | やや話題 |
| 50-99 | `#ffe0e0` | `#ff6666` | 話題 |
| 100-499 | `#ff6666` | `#ffffff` | 人気 |
| 500+ | `#ff3333` | `#ffffff` | 大人気 (炎上含む) |

> 本プロジェクトでは HN の score (ポイント) をこの段階に読み替える

### デザイン
- 形状: 角丸 (`border-radius: 3px`)
- パディング: `2px 6px`
- フォントサイズ: `11px`
- フォントウェイト: `bold`
- テキスト: `{数値} users`

---

## 6. サイドバー (Sidebar)

### 含まれる要素
1. **人気エントリーランキング** (1-10位)
2. **カテゴリ別リンク**
3. **広告枠** (本プロジェクトでは不要)

### デザイン
- 背景: `#ffffff`
- ボーダー: `1px solid #e8e8e8`
- セクション見出し:
  - フォントサイズ: `14px`
  - フォントウェイト: `bold`
  - 背景: `#f5f5f5`
  - パディング: `8px 12px`

---

## 7. カラーパレット

### Semantic (プロジェクト定義)

#### Primary
| 名前 | 値 | 用途 |
|---|---|---|
| hatena-blue | `#1d7ab3` | ブランドカラー、リンク、アクティブタブ |
| hatena-blue-hover | `#166a9e` | ホバー時 |

#### Neutral
| 名前 | 値 | 用途 |
|---|---|---|
| bg-primary | `#ffffff` | カード背景、ヘッダー背景 |
| bg-secondary | `#f5f5f5` | ページ背景 |
| border | `#e8e8e8` | カード・セクションの区切り |
| text-primary | `#333333` | メインテキスト |
| text-secondary | `#666666` | サブテキスト |
| text-muted | `#999999` | メタ情報、ドメイン |

#### Accent (ブックマーク数)
| 名前 | 値 | 用途 |
|---|---|---|
| bookmark-cold | `#f0f0f0` | 少ブクマ |
| bookmark-warm | `#ff9900` | 中ブクマ |
| bookmark-hot | `#ff6666` | 多ブクマ |
| bookmark-fire | `#ff3333` | 超人気 |

### Extracted (サイトから自動抽出、出現頻度順)
| 色 | 出現数 |
|---|---|
| `#fff` | 583 |
| `rgba(70,82,94,.8)` | 414 |
| `#009ad0` | 372 |
| `#ececec` | 276 |
| `#55606a` | 189 |
| `#f6f7f8` | 183 |
| `#25282b` | 177 |
| `#333` | 154 |
| `#ccc` | 149 |
| `#374148` | 126 |

---

## 8. タイポグラフィ

### フォントファミリー
```css
font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
```

### サイトから検出されたフォント
- `sans-serif`
- `monospace,serif`
- `inherit`
- `Hiragino Fixed`
- `Helvetica,Arial,Roboto,Hiragino Fixed,Hiragino Sans,sans-serif`
- `Arial,sans-serif`
- `monaco,Helvetica,Arial,Roboto,sans-serif`
- `Courier,monospace`
- `Helvetica,Arial`
- `Helvetica Neue,Helvetica,Arial,Hiragino Kaku Gothic Pro,Meiryo,MS PGothic,sans-serif`
- `arial,sans-serif`
- `Lucida Grande, Helvetica, Arial, sans-serif`
- `'Iconochive-Regular'`
- `'Iconochive-Regular'!important`

### サイズ一覧
| 要素 | size | weight | line-height |
|---|---|---|---|
| body | `14px` | `normal` | `1.6` |
| エントリータイトル | `15px` | `bold` | `1.4` |
| メタ情報 | `12px` | `normal` | `1.4` |
| カテゴリタブ | `13px` | `normal / bold (active)` | `1.0` |
| セクション見出し | `14px` | `bold` | `1.4` |
| ブクマ数バッジ | `11px` | `bold` | `1.0` |

### サイトから検出されたサイズ (出現頻度順)
| サイズ | 出現数 |
|---|---|
| `12px` | 398 |
| `14px` | 380 |
| `13px` | 324 |
| `11px` | 123 |
| `16px` | 114 |
| `15px` | 54 |
| `10px` | 39 |
| `18px` | 39 |
| `20px` | 33 |
| `0` | 18 |

---

## 9. スペーシング

| 要素 | 値 |
|---|---|
| ページ左右パディング | `16px` |
| カード内パディング | `12px 16px` |
| カード間マージン | `0` (ボーダー区切り) |
| サムネイルとテキストの間 | `12px` |
| メタ情報の項目間 | `8px` |
| セクション間 | `24px` |
| ヘッダー高さ | `50px` (上段) + `40px` (下段) |

---

## 10. レスポンシブ

| ブレークポイント | レイアウト |
|---|---|
| `>= 1100px` | 2カラム (メイン + サイドバー) |
| `768px - 1099px` | 1カラム (サイドバー下に移動) |
| `< 768px` | 1カラム、カテゴリタブ横スクロール、サムネイル縮小 |

---

## 11. HN → はてブ マッピング

| はてブ要素 | HN対応 |
|---|---|
| ブックマーク数 (`users`) | score (ポイント) |
| ブックマークコメント | comments |
| カテゴリ | top / new / best stories |
| エントリーURL | story URL |
| エントリータイトル | story title |
| 投稿者 | story author (`by`) |
| 投稿時刻 | story time |

---

## 12. Computed Styles (ブラウザ実測値)

> Puppeteer の `getComputedStyle` で取得した実際の描画値。CSS抽出より信頼性が高い。

### body
| プロパティ | 値 |
|---|---|
| fontFamily | `Helvetica, Arial, Roboto, "Hiragino Fixed", "Hiragino Sans", sans-serif` |
| fontSize | `16px` |
| color | `rgb(37, 40, 43)` |
| backgroundColor | `rgba(0, 0, 0, 0)` |
| lineHeight | `24px` |

### header
| プロパティ | 値 |
|---|---|
| backgroundColor | `rgba(0, 0, 0, 0)` |
| height | `12117.8px` |
| borderBottom | `0px none rgb(37, 40, 43)` |
| padding | `0px` |

### entryCard
| プロパティ | 値 |
|---|---|
| backgroundColor | `rgba(0, 0, 0, 0)` |
| padding | `0px` |
| margin | `0px` |
| border | `0px none rgb(37, 40, 43)` |
| borderBottom | `0px none rgb(37, 40, 43)` |

### entryTitle
| プロパティ | 値 |
|---|---|
| color | `rgb(0, 0, 238)` |
| fontSize | `32px` |
| fontWeight | `700` |
| lineHeight | `48px` |
| textDecoration | `underline` |

### link
| プロパティ | 値 |
|---|---|
| color | `rgb(0, 0, 238)` |
| textDecoration | `none` |

> 他のページの実測値: computed-top.json

