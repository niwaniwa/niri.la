# niri.la 要件定義

## 概要

Astro公式チュートリアルとFuwariテーマを参考に、自分の手で実装することでAstroを学習するプロジェクト。

## 技術スタック

- **フレームワーク**: Astro 5.x
- **スタイリング**: Tailwind CSS 4.x
- **言語**: TypeScript
- **検索**: Pagefind
- **コンテンツ**: Markdown + Content Collections

---

## ページ構成

### 1. About（トップページ）

| 項目 | 内容                                  |
| ---- | ------------------------------------- |
| パス | `/`                                   |
| 説明 | 自己紹介・プロフィールページ          |
| 内容 | 名前、自己紹介文、スキル、SNSリンク等 |

### 2. Blog

| 項目       | 内容                            |
| ---------- | ------------------------------- |
| 一覧パス   | `/blog`                         |
| 記事パス   | `/blog/[slug]`                  |
| 説明       | ブログ記事の一覧と個別ページ    |
| コンテンツ | Markdown（Content Collections） |

#### Blog記事のフロントマター

```yaml
title: 記事タイトル
description: 記事の説明
pubDate: 2024-01-01
updatedDate: 2024-01-02 # optional
tags: [astro, web] # optional
draft: false # optional
```

### 3. Works

| 項目       | 内容                                 |
| ---------- | ------------------------------------ |
| 一覧パス   | `/works`                             |
| 記事パス   | `/works/[slug]`                      |
| 説明       | 作品・プロジェクトの一覧と個別ページ |
| コンテンツ | Markdown（Content Collections）      |

#### Works記事のフロントマター

```yaml
title: プロジェクト名
description: プロジェクトの説明
pubDate: 2024-01-01
tags: [typescript, astro] # optional
url: https://example.com # optional（デモURL）
repo: https://github.com/ # optional（リポジトリURL）
image: /images/project.png # optional（サムネイル）
```

---

## 機能要件

### 1. ページトランジション

- **技術**: View Transitions API
- **内容**: ページ遷移時のスムーズなアニメーション
- **参考**: Astro View Transitions

### 2. ダークモード

- **内容**: ライト/ダークテーマの切り替え
- **保存**: localStorage でユーザー設定を保持
- **初期値**: システム設定（prefers-color-scheme）に従う

### 3. 検索機能

- **技術**: Pagefind
- **内容**: サイト全体の全文検索
- **対象**: Blog記事、Works記事

### 4. レスポンシブデザイン

- **ブレークポイント**:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
- **対応**: ナビゲーション、カードレイアウト、記事本文

### 5. Markdown拡張

- **コードハイライト**: Shiki（Astro標準）
- **その他**:
  - 注釈（footnotes）
  - テーブル
  - タスクリスト

### 6. TOC（目次）

- **内容**: 記事ページにh2/h3から目次を自動生成
- **機能**: クリックで該当箇所にスクロール
- **表示**: サイドバーまたは記事上部

### 7. RSSフィード

- **パス**: `/rss.xml`
- **内容**: Blog記事のフィード配信
- **技術**: @astrojs/rss

---

## 実装フェーズ

### Phase 1: 基盤 + About

- [ ] BaseLayout（HTML構造、head、メタ情報）
- [ ] ナビゲーションコンポーネント
- [ ] フッターコンポーネント
- [ ] トップページ（About）実装
- [ ] レスポンシブ基本対応
- [ ] ダークモード実装

### Phase 2: Blog

- [ ] Content Collection設定（blog）
- [ ] ブログ一覧ページ `/blog`
- [ ] ブログ記事ページ `/blog/[slug]`
- [ ] 記事カードコンポーネント
- [ ] サンプル記事作成
- [ ] TOC（目次）コンポーネント
- [ ] Markdown拡張設定

### Phase 3: Works

- [ ] Content Collection設定（works）
- [ ] Works一覧ページ `/works`
- [ ] Works記事ページ `/works/[slug]`
- [ ] Worksカードコンポーネント
- [ ] サンプル作品作成

### Phase 4: 機能拡張

- [ ] ページトランジション（View Transitions）
- [ ] 検索機能（Pagefind）
- [ ] RSSフィード生成
- [ ] タグ一覧ページ
- [ ] OGP画像対応

---

## ディレクトリ構成（予定）

```
src/
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── Nav.astro
│   ├── ThemeToggle.astro
│   ├── BlogCard.astro
│   ├── WorkCard.astro
│   ├── TOC.astro
│   └── Search.astro
├── content/
│   ├── blog/
│   │   └── *.md
│   ├── works/
│   │   └── *.md
│   └── config.ts
├── layouts/
│   ├── BaseLayout.astro
│   └── PostLayout.astro
├── pages/
│   ├── index.astro          # About
│   ├── blog/
│   │   ├── index.astro      # Blog一覧
│   │   └── [slug].astro     # Blog記事
│   ├── works/
│   │   ├── index.astro      # Works一覧
│   │   └── [slug].astro     # Works記事
│   └── rss.xml.ts
└── styles/
    └── global.css
```

---

## 参考リソース

- [Astro公式チュートリアル](https://docs.astro.build/ja/tutorial/0-introduction/)
- [Fuwari](https://github.com/saicaca/fuwari)
- [Astro View Transitions](https://docs.astro.build/ja/guides/view-transitions/)
- [Pagefind](https://pagefind.app/)
- [@astrojs/rss](https://docs.astro.build/ja/guides/rss/)
