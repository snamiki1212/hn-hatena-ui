# ADR-003: ビルド時の日本語翻訳機能

## Status

**Proposed**

## Context

HN APIのコンテンツ（ストーリータイトル等）は全て英語で提供される。本プロジェクトのターゲットユーザーは日本語話者であるため、英語コンテンツをそのまま表示するとUX上の障壁となる。

### 要件

| # | 要件 | 重要度 |
|---|------|--------|
| R1 | ビルド時（SSG）に英語 → 日本語翻訳を実行する | 必須 |
| R2 | 日本語をメイン表示、英語をサブ（小テキスト）表示する | 必須 |
| R3 | 翻訳失敗時は英語にフォールバックし、ビルドを止めない | 必須 |
| R4 | APIキー不要 or 無料枠で対応できる | 必須 |
| R5 | GitHub Actions cron ビルド（1日4回）に耐えられるレート制限 | 必須 |

### 制約

- SSGのためビルド時のみ実行（ランタイム翻訳は不可）
- 1ビルドあたり最大30件のストーリータイトルを翻訳
- GitHub Actionsの cron は1日4回（6時間ごと）

## Candidates

### 1. MyMemory API

- **コスト**: 無料（APIキー不要）
- **制限**: 1,000 words/day per IP（登録なし）
- **品質**: Microsoft Translator + human contribution ベース。実用的
- **実装**: `GET https://api.mymemory.translated.net/get?q={text}&langpair=en|ja`
- **評価**: 30件 × 平均10 words = 300 words/build × 4 builds/day = 1,200 words/day → 制限ギリギリ

### 2. Google Translate (非公式エンドポイント)

- **コスト**: 無料（APIキー不要）
- **制限**: 公式な制限なし（非公式のため変更・廃止リスクあり）
- **品質**: 高品質
- **実装**: `GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q={text}`
- **評価**: 非公式エンドポイントのため、突然の廃止・ブロックリスクがある。本番利用には不安定

### 3. DeepL API (無料枠)

- **コスト**: 無料（ただし要アカウント登録 + APIキー）
- **制限**: 500,000 chars/month（無料枠）
- **品質**: 高品質、特に日英翻訳
- **実装**: `POST https://api-free.deepl.com/v2/translate` + APIキーが必要
- **評価**: 品質は最高水準だがAPIキーの管理（GitHub Secrets設定）が必要。キーなし運用を優先するならオーバーエンジニアリング

### 4. LibreTranslate (パブリックインスタンス)

- **コスト**: 無料
- **制限**: インスタンスによって異なる（不安定）
- **品質**: オープンソース、精度はMyMemoryより低い傾向
- **実装**: `POST https://libretranslate.de/translate`
- **評価**: パブリックインスタンスの可用性が不安定。CI/CDビルドに不向き

### 5. ローカルLLM (Ollama)

- **コスト**: 無料
- **制限**: なし（ローカル実行）
- **品質**: モデル依存（Llama 3等ならば高品質）
- **評価**: GitHub Actions での実行には要セットアップ。ビルド時間が大幅増加。CI環境での安定運用が困難

## Comparison Matrix

| 観点 | MyMemory | Google (非公式) | DeepL Free | LibreTranslate | Ollama |
|------|----------|-----------------|------------|----------------|--------|
| R1 ビルド時実行 | ◎ | ◎ | ◎ | ◎ | △ |
| R2 日→英表示対応 | ◎ | ◎ | ◎ | ◎ | ◎ |
| R3 フォールバック | ◎ | ◎ | ◎ | ◎ | ◎ |
| R4 APIキー不要 | ◎ | ◎ | × | ◎ | ◎ |
| R5 レート制限 | △ | ◎ | ◎ | △ | ◎ |
| 安定性 | ○ | △ | ◎ | △ | △ |

## Decision

**MyMemory API を採用する。**

### 理由

1. **APIキー不要**: GitHub Secrets設定不要。リポジトリ設定変更なしですぐ動く
2. **公式無料サービス**: Google非公式エンドポイントと異なり、廃止・ブロックリスクが低い
3. **フォールバック設計**: 翻訳失敗時は英語表示にフォールバックするため、レート超過でもビルド失敗しない
4. **十分な品質**: HNのタイトル翻訳（技術英語）に対して実用的な精度

### 将来の移行パス

レート制限が問題になった場合は DeepL Free (APIキー追加) へ移行する。翻訳モジュールを `src/api/translate.ts` に集約するため、切り替えコストは低い。

### 実装方針

```
src/api/translate.ts        ← MyMemory APIラッパー（差し替え可能）
src/api/hn/types.ts         ← HnStory に titleJa?: string を追加
src/api/hn/client.ts        ← getStory() で翻訳を付与
src/pages/index.astro       ← 日本語メイン・英語サブ表示
src/pages/story/[id].astro  ← 同上
```

### UI表示方針

```html
<!-- 日本語メイン・英語サブ -->
<span lang="ja">{story.titleJa ?? story.title}</span>
<small lang="en">{story.title}</small>
```

## Consequences

- **ポジティブ**: 日本語話者のUXが向上。追加コスト・設定ゼロ
- **ネガティブ**: 1日4ビルドでレート制限ギリギリ。超過時は英語表示にフォールバック（ビルドは成功）
- **ビルド時間**: 30件の並列API呼び出しが追加される。MyMemoryのレスポンスは概ね100-500ms/件
- **品質**: 機械翻訳のため、専門用語（技術スラング等）の翻訳精度は限定的
