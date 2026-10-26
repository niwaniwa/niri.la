# Notion ブログ連携 PoC

既存 Markdown のブログ記事を残し、Notion DB の `公開中` の記事だけを Cloudflare Pages のビルド時に追加する PoC。Notion の変更通知は使わず、Pages の本番ブランチへの push、手動 GitHub Actions、日次 Cron Worker のいずれかがビルドを起動する。実装前の判断事項は[設計書](./notion-blog-publishing-design.md)に記載する。

## ビルドの処理

`npm run build` は次を順番に実行する。

1. `scripts/notion-sync.mjs` が Notion API `2026-03-11` でデータソースの全ページを読み、`公開中` の記事だけ [Markdown 取得 API](https://developers.notion.com/reference/retrieve-page-markdown) で取得する。ページング、公開状態、必須項目、Slug の衝突を検査する。
2. 本文中と `HeroImage` の画像をダウンロードし、`public/notion-images/` に保存する。公開記事の Markdown を `src/content/blogs/notion--<slug>.md` に一時生成する。`canonicalSlug` により URL は既存記事と同じ `/blog/<slug>/` になる。生成物は Git に追加しない。
3. Astro と Pagefind が `dist/` を作る。下書き・非公開の記事は詳細、一覧、RSS、タグ、検索索引に出さない。
4. `scripts/notion-verify.mjs` が公開記事の詳細、ブログ一覧、RSS、検索索引、画像、`404.html` の出力を確認し、公開対象とページ最終編集日時を再取得して比較する。欠落や変化があればビルドを失敗させ、Pages は新しい版を公開しない。

PoC が受け入れる本文は標準的な Markdown と `<br>`。Notion の独自タグ、未対応ブロック、取得欠落があればビルド全体を失敗させる。画像は PNG/JPEG/GIF/WebP/AVIF、1 ファイル 10 MiB まで。Notion の署名付き画像 URL は生成 HTML に残さない。`notion--` で始まる Markdown ファイル名は生成用に予約する。

## 設定

1. Notion の Internal connection に `read_content` 権限を付け、[ブログ記事用 DB](https://app.notion.com/p/kinel/3fc8b0658d308049b782f37ccea9b3d1?v=3fc8b0658d3080f3b9a5000c5f5206f9) を共有する。DB の列名は設計書の表に合わせる。
2. Cloudflare Pages の**本番環境**に `NOTION_TOKEN` を secret として登録する。データソース ID の既定値は `3fc8b065-8d30-80a1-991f-000b80621903`。変更する場合は `NOTION_DATA_SOURCE_ID` を設定する。本番ブランチの既定値は `main`。違う場合は `NOTION_PRODUCTION_BRANCH` を設定する。
3. Pages のビルドコマンドを `npm run build`、出力ディレクトリを `dist` にする。本番ブランチで `NOTION_TOKEN` がなければビルドは失敗する。Pages のプレビューブランチでは Notion を取得せず、既存 Markdown だけを表示する。
4. Pages の本番ブランチ用 [Deploy Hook](https://developers.cloudflare.com/pages/configuration/deploy-hooks/) を作り、URL を GitHub Actions secret `PAGES_DEPLOY_HOOK_URL` に登録する。手動の [Rebuild blog from Notion](../.github/workflows/rebuild-from-notion.yml) は `main` から実行する。
5. 定期起動する場合は [Cron Worker](../workers/notion-deploy-trigger/README.md) に同じ Hook URL を runtime secret として設定し、Worker をデプロイする。PoC の設定は毎日 00:00 UTC。Hook への POST 成功はビルド起動だけを意味する。公開完了は Pages のデプロイ履歴で確認する。

トークンと Hook URL は Git やビルドログに書かない。ローカルでは `NOTION_TOKEN` を環境変数として渡すと Notion 記事を含めたビルドを試せる。トークンがない場合は Notion 生成物を消して既存記事だけをビルドする。`.env.local` は Git 管理外だが、`npm run build` はこのファイルを自動では読み込まない。

## 確認

```sh
npm ci
npm run test:notion
npm run build
```

PoC の自動テストは API 応答と画像を模擬し、公開・非公開、画像保存、Slug 衝突、ビルド中の非公開化を検査する。実 DB・Pages・Deploy Hook への接続確認には、それぞれの認証情報と設定が必要。
