# にりら用サイト

## 🚀 Project Structure

```text
.
├── README.md
├── astro.config.mjs
├── dist
├── docs
├── node_modules
├── package-lock.json
├── package.json
├── public
├── src
└── tsconfig.json
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 今後の予定

- [ ] OGPの自動生成
- [ ] リファクタ

## 設計資料

- [Notion からブログを公開する処理の設計](docs/notion-blog-publishing-design.md)
- [Notion 連携 PoC の設定と確認方法](docs/notion-blog-poc.md)

## refarence

- テーマのtoggleについて以下のサイトを参考にさせていただきました🙇
  - https://yamatatsu-maru.com/blogs/2025-05-14-implement-dark-mode-astro-tailwindcssv4/
