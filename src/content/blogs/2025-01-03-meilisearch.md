---
title: "misskeyに後からmeilisearchを使って検索を入れる"
description: "meilisearchを使った全文検索機能の追加"
pubDate: 2026-01-03
tags: ["meilisearch", "misskey"]
draft: false
emoji: "🔍"
---

## まずmeilisearchを投入する

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: meilisearch
  namespace: misskey
  labels:
    app: meilisearch
spec:
  restartPolicy: Always
  containers:
    - name: meilisearch
      image: getmeili/meilisearch:prototype-japanese-13
      env:
        - name: MEILI_MASTER_KEY
          value: "ここは適当にUUIDを生成して変えておく。それか一度なしで起動してmasterを取り出すなど"
      volumeMounts:
        - mountPath: /meili_data
          name: meilisearch-volume
      ports:
        - containerPort: 7700
  volumes:
    - name: meilisearch-volume
      persistentVolumeClaim:
        claimName: misskey-meilisearch-pvc
    - name: meilisearch-config-file
      configMap:
        name: misskey-meilisearch-config

---
apiVersion: v1
kind: Pod
metadata:
  name: meilisearch-ui
  namespace: misskey
  labels:
    app: meilisearch-ui
spec:
  restartPolicy: Always
  containers:
    - name: meilisearch-ui
      image: riccoxie/meilisearch-ui:latest
```

## 次にMisskeyにmeilisearchを設定する

### まずAPIキーを確認する

- MeilisearchのIPに対してAPIキーの問い合わせを行う。
  - JSONで帰ってくるので適当にフォーマットしてKeyを取得する

```jsx
curl -X GET 'http://192.168.1.2:30873/keys' \
-H 'Authorization: Bearer <ここにMasterキー>'
```

### APIキーを用いて設定する

misskeyの設定を変更する

```yaml
#   ┌───────────────────────────────┐
#───┘ Fulltext search configuration └─────────────────────────────

# These are the setting items for the full-text search provider.
fulltextSearch:
  # You can select the ID generation method.
  # - sqlLike (default)
  #   Use SQL-like search.
  #   This is a standard feature of PostgreSQL, so no special extensions are required.
  # - sqlPgroonga
  #   Use pgroonga.
  #   You need to install pgroonga and configure it as a PostgreSQL extension.
  #   In addition to the above, you need to create a pgroonga index on the text column of the note table.
  #   see: https://pgroonga.github.io/tutorial/
  # - meilisearch
  #   Use Meilisearch.
  #   You need to install Meilisearch and configure.
  provider: meilisearch

# For Meilisearch settings.
# If you select "meilisearch" for "fulltextSearch.provider", it must be set.
# You can set scope to local (default value) or global
# (include notes from remote).

meilisearch:
  host: meilisearch
  port: 7700
  apiKey: "APIキー"
  ssl: false # sslならtrueに
  index: "misskey-niri-la" # なんかいい感じにする
  scope: "global" # localかglobalか
```

- Misskeyを再起動したのち、ノートを行って検索できるか確認する

💡 ここで最初に設定を行うようにしないとデータ量が膨大になって一向に進まなくなる

## ImportするためのPodを作る

```jsx
kubectl run temp-cli   --rm -i -t -n misskey   --image=node:20-bullseye   -- bash
```

## ツールをImport

https://github.com/noellabo/misskey_meilisearch_importer

```jsx
apt update && apt install -y git
npm install -g pnpm
git clone https://github.com/noellabo/misskey_meilisearch_importer.git
```

## config入れて設定して終わり

```jsx
node importer.js --config default.yaml
```
