# Notion 記事の定期ビルド起動

この Worker は毎日 00:00 UTC（09:00 JST）に Cloudflare Pages の Deploy Hook に POST し、Notion 記事を再取得する Pages ビルドを**起動**します。時刻は [`wrangler.jsonc`](./wrangler.jsonc) の `triggers.crons` で変更できます。Hook の応答成功は公開完了を意味しません。公開結果は Pages の本番デプロイ履歴で確認します。

## 設定

1. 既存の Pages プロジェクトで、本番ブランチ（想定: `main`）に紐づく Deploy Hook を作成します。
2. Hook URL を GitHub リポジトリの Actions secret `PAGES_DEPLOY_HOOK_URL` に登録します。手動実行には [Rebuild blog from Notion](../../.github/workflows/rebuild-from-notion.yml) を `main` から起動します。
3. 同じ Hook URL を、この Worker の runtime secret `PAGES_DEPLOY_HOOK_URL` に登録して Worker をデプロイします。デプロイ時に secret を同時に渡す場合は、リポジトリ外の `.env` ファイルを使って `wrangler deploy --config workers/notion-deploy-trigger/wrangler.jsonc --secrets-file /absolute/path/to/private/notion-trigger.env` を実行できます。secret ファイルには `PAGES_DEPLOY_HOOK_URL=...` を記載し、Git に追加しないでください。

この Worker は HTTP 公開口を持ちません。Notion の認証情報は Pages のビルド環境にのみ設定します。起動が失敗した場合は Worker の実行ログ、ビルド以降の失敗は Pages のデプロイ履歴を確認します。

参照: [Pages Deploy Hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
