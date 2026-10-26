import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createNotionClient,
  publicPost,
  rewriteMarkdownImages,
  shouldSync,
  syncNotion,
} from "../scripts/notion-sync.mjs";
import { verifyNotion } from "../scripts/notion-verify.mjs";

const ID = "11111111-1111-4111-8111-111111111111";
const DATA_SOURCE_ID = "3fc8b065-8d30-80a1-991f-000b80621903";

function page(status, slug = "from-notion") {
  return {
    object: "page",
    id: ID,
    in_trash: false,
    last_edited_time: "2026-10-26T00:00:00.000Z",
    properties: {
      Status: { type: "select", select: { name: status } },
      名前: { type: "title", title: [{ plain_text: "Notion の記事" }] },
      Description: { type: "rich_text", rich_text: [{ plain_text: "説明文" }] },
      Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
      PublishedAt: { type: "date", date: { start: "2026-10-26", end: null } },
      Tags: { type: "multi_select", multi_select: [{ name: "Notion" }] },
      HeroImage: { type: "files", files: [] },
    },
  };
}

function fakeFetch(state) {
  return async (url, options = {}) => {
    if (url.includes(`/data_sources/${DATA_SOURCE_ID}/query`)) {
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Notion-Version"], "2026-03-11");
      return Response.json({
        results: state.pages,
        has_more: false,
        next_cursor: null,
      });
    }
    if (url.includes(`/pages/${ID}/markdown`)) {
      return Response.json({
        object: "page_markdown",
        id: ID,
        markdown: state.markdown,
        truncated: false,
        unknown_block_ids: [],
      });
    }
    if (url === "https://images.example.test/photo.png") {
      return new Response(
        Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ", "base64"),
        {
          headers: { "content-type": "image/png" },
        },
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  };
}

async function project(t) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "niri-notion-test-"));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await fs.mkdir(path.join(rootDir, "src/content/blogs"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "public"));
  await fs.writeFile(
    path.join(rootDir, "src/content/blogs/existing.md"),
    "---\ntitle: Existing\n---\n",
  );
  return rootDir;
}

test("only published, non-trash pages become posts", () => {
  assert.equal(publicPost(page("下書き")), null);
  assert.equal(publicPost(page("非公開")), null);
  const blank = page("下書き");
  blank.properties.Status.select = null;
  assert.equal(publicPost(blank), null);
  assert.equal(publicPost({ ...page("公開中"), in_trash: true }), null);
  assert.equal(publicPost(page("公開中")).slug, "from-notion");
  assert.throws(() => publicPost(page("unknown")), /unknown Status/);
  assert.throws(() => publicPost(page("公開中", "Unsafe/Slug")), /valid Slug/);
});

test("image rewriting leaves fenced code alone and refuses custom Notion tags", async () => {
  const input =
    "```md\n![example](https://images.example.test/code.png)\n```\n![photo](https://images.example.test/photo.png)";
  const result = await rewriteMarkdownImages(input, async (url) => {
    assert.equal(url, "https://images.example.test/photo.png");
    return "/notion-images/photo.png";
  });
  assert.match(result, /code\.png/);
  assert.match(result, /!\[photo\]\(\/notion-images\/photo\.png\)/);
  await assert.rejects(
    () => rewriteMarkdownImages("<callout>secret</callout>", async () => ""),
    /unsupported HTML/,
  );
});

test("data source pagination is complete and rejects Notion's silent result cap", async () => {
  const fetchImpl = async (_url, options) => {
    const cursor = JSON.parse(options.body).start_cursor;
    return Response.json(
      cursor
        ? { results: [page("非公開")], has_more: false, next_cursor: null }
        : { results: [page("公開中")], has_more: true, next_cursor: "next" },
    );
  };
  const notion = createNotionClient({
    token: "test",
    dataSourceId: DATA_SOURCE_ID,
    fetchImpl,
  });
  assert.equal((await notion.pages()).length, 2);
  const capped = createNotionClient({
    token: "test",
    dataSourceId: DATA_SOURCE_ID,
    fetchImpl: async () =>
      Response.json({
        results: [page("公開中")],
        has_more: false,
        next_cursor: null,
        request_status: {
          type: "incomplete",
          incomplete_reason: "query_result_limit_reached",
        },
      }),
  });
  await assert.rejects(() => capped.pages(), /result limit/);
});

test("sync creates only public Markdown and local images, then detects an unpublish", async (t) => {
  const rootDir = await project(t);
  const published = page("公開中");
  published.properties.HeroImage.files = [
    { type: "file", file: { url: "https://images.example.test/photo.png" } },
  ];
  const state = {
    pages: [published],
    markdown: "# 本文\n![写真](https://images.example.test/photo.png)",
  };
  const env = {
    NOTION_TOKEN: "test-token",
    NOTION_DATA_SOURCE_ID: DATA_SOURCE_ID,
  };
  const fetchImpl = fakeFetch(state);
  const result = await syncNotion({ rootDir, env, fetchImpl });
  assert.equal(result.count, 1);
  const article = await fs.readFile(
    path.join(rootDir, "src/content/blogs/notion--from-notion.md"),
    "utf8",
  );
  assert.match(article, /canonicalSlug: from-notion/);
  assert.match(article, /pubDate: 2026-10-26/);
  assert.match(article, /\/notion-images\/[a-f0-9]{20}\.png/);
  assert.match(article, /image: "\/notion-images\/[a-f0-9]{20}\.png"/);
  assert.doesNotMatch(article, /images\.example\.test/);
  const images = await fs.readdir(path.join(rootDir, "public/notion-images"));
  assert.equal(images.length, 1);
  for (const file of [
    "404.html",
    "blog/index.html",
    "blog/rss.xml",
    "pagefind/pagefind-entry.json",
    "blog/from-notion/index.html",
  ]) {
    const target = path.join(rootDir, "dist", file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "fixture");
  }
  await fs.mkdir(path.join(rootDir, "dist/notion-images"));
  await fs.copyFile(
    path.join(rootDir, "public/notion-images", images[0]),
    path.join(rootDir, "dist/notion-images", images[0]),
  );
  await verifyNotion({ rootDir, env, fetchImpl });

  await fs.rm(path.join(rootDir, "dist/blog/from-notion/index.html"));
  await assert.rejects(
    () => verifyNotion({ rootDir, env, fetchImpl }),
    /ENOENT/,
  );
  await fs.writeFile(
    path.join(rootDir, "dist/blog/from-notion/index.html"),
    "fixture",
  );

  state.pages = [page("非公開")];
  await assert.rejects(
    () => verifyNotion({ rootDir, env, fetchImpl }),
    /changed during build/,
  );
  await syncNotion({ rootDir, env, fetchImpl });
  assert.deepEqual(
    await fs.readdir(path.join(rootDir, "src/content/blogs")),
    ["existing.md", ".notion-snapshot.json"].sort(),
  );
  assert.deepEqual(
    await fs.readdir(path.join(rootDir, "public/notion-images")),
    [],
  );
});

test("slug collisions fail without replacing existing content", async (t) => {
  const rootDir = await project(t);
  const state = { pages: [page("公開中", "existing")], markdown: "Body" };
  await assert.rejects(
    () =>
      syncNotion({
        rootDir,
        env: { NOTION_TOKEN: "test-token" },
        fetchImpl: fakeFetch(state),
      }),
    /Duplicate blog Slug/,
  );
  assert.equal(
    await fs.readFile(
      path.join(rootDir, "src/content/blogs/existing.md"),
      "utf8",
    ),
    "---\ntitle: Existing\n---\n",
  );
});

test("production requires a token; local builds remove old generated content", async (t) => {
  assert.throws(
    () => shouldSync({ CF_PAGES_BRANCH: "main" }),
    /NOTION_TOKEN is required/,
  );
  assert.throws(
    () => shouldSync({ CF_PAGES: "1" }),
    /CF_PAGES_BRANCH is required/,
  );
  const rootDir = await project(t);
  await fs.writeFile(
    path.join(rootDir, "src/content/blogs/notion--old.md"),
    "old",
  );
  await syncNotion({ rootDir, env: {} });
  await assert.rejects(
    () => fs.access(path.join(rootDir, "src/content/blogs/notion--old.md")),
    /ENOENT/,
  );
});
