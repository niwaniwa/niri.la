import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";

const NOTION_VERSION = "2026-03-11";
const DEFAULT_DATA_SOURCE_ID = "3fc8b065-8d30-80a1-991f-000b80621903";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function hasImageSignature(bytes, mime) {
  if (mime === "image/png")
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mime === "image/jpeg")
    return bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (mime === "image/gif")
    return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  if (mime === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  if (mime === "image/avif")
    return (
      bytes.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(bytes.toString("ascii", 8, 12))
    );
  return false;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function pathsFor(rootDir) {
  return {
    posts: path.join(rootDir, "src/content/blogs"),
    snapshot: path.join(rootDir, "src/content/blogs/.notion-snapshot.json"),
    images: path.join(rootDir, "public/notion-images"),
  };
}

export function shouldSync(env) {
  const branch = env.CF_PAGES_BRANCH;
  const productionBranch = env.NOTION_PRODUCTION_BRANCH || "main";
  if (env.CF_PAGES && !branch)
    throw new Error("CF_PAGES_BRANCH is required in Pages builds");
  if (branch && branch !== productionBranch) return false;
  if (!env.NOTION_TOKEN && branch === productionBranch) {
    throw new Error("NOTION_TOKEN is required for the production Pages build");
  }
  return Boolean(env.NOTION_TOKEN);
}

export function createNotionClient({
  token,
  dataSourceId,
  fetchImpl = fetch,
  wait = delay,
}) {
  const baseUrl = "https://api.notion.com/v1";

  async function request(endpoint, { method = "GET", body } = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetchImpl(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response.json();
      if (
        ![429, 502, 503, 504, 529].includes(response.status) ||
        attempt === 3
      ) {
        throw new Error(
          `Notion API ${method} ${endpoint} failed (${response.status})`,
        );
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      await wait(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30_000)
          : 1000 * 2 ** attempt,
      );
    }
  }

  async function pages() {
    const results = [];
    const seenCursors = new Set();
    let cursor;
    do {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const response = await request(
        `/data_sources/${encodeURIComponent(dataSourceId)}/query`,
        { method: "POST", body },
      );
      if (
        !Array.isArray(response.results) ||
        typeof response.has_more !== "boolean"
      ) {
        throw new Error("Notion returned an incomplete data source response");
      }
      if (response.request_status?.type === "incomplete") {
        throw new Error("Notion data source query hit its result limit");
      }
      results.push(...response.results);
      if (!response.has_more) break;
      cursor = response.next_cursor;
      if (!cursor || seenCursors.has(cursor))
        throw new Error("Notion pagination cursor is missing or repeated");
      seenCursors.add(cursor);
    } while (true);
    return results;
  }

  async function markdown(pageId) {
    const result = await request(
      `/pages/${encodeURIComponent(pageId)}/markdown`,
    );
    if (
      result.object !== "page_markdown" ||
      typeof result.markdown !== "string" ||
      result.truncated !== false ||
      !Array.isArray(result.unknown_block_ids) ||
      result.unknown_block_ids.length > 0
    ) {
      throw new Error(`Notion markdown for page ${pageId} is incomplete`);
    }
    return result.markdown;
  }

  return { pages, markdown };
}

function plainText(property, type, label) {
  if (property?.type !== type || !Array.isArray(property[type])) {
    throw new Error(`Notion property ${label} must be ${type}`);
  }
  return property[type]
    .map((item) => item.plain_text ?? item.text?.content ?? "")
    .join("")
    .trim();
}

function fileUrl(file) {
  if (file.type === "file") return file.file?.url;
  if (file.type === "external") return file.external?.url;
  throw new Error("HeroImage contains an unsupported file type");
}

export function publicPost(page) {
  if (page.in_trash) return null;
  const status = page.properties?.Status;
  if (!status || !["select", "status"].includes(status.type)) {
    throw new Error(`Page ${page.id} has an invalid Status property`);
  }
  const state =
    status?.type === "select"
      ? status.select?.name
      : status?.type === "status"
        ? status.status?.name
        : undefined;
  if (state == null) return null;
  if (!["公開中", "下書き", "非公開"].includes(state)) {
    throw new Error(`Page ${page.id} has an unknown Status`);
  }
  if (state !== "公開中") return null;

  const title = plainText(page.properties["名前"], "title", "名前");
  const description = plainText(
    page.properties.Description,
    "rich_text",
    "Description",
  );
  const slug = plainText(page.properties.Slug, "rich_text", "Slug");
  if (!title || !description || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `Published page ${page.id} needs a title, description and valid Slug`,
    );
  }
  const date = page.properties.PublishedAt;
  if (
    date?.type !== "date" ||
    !date.date?.start ||
    date.date.end ||
    !/^\d{4}-\d{2}-\d{2}/.test(date.date.start) ||
    Number.isNaN(Date.parse(date.date.start))
  ) {
    throw new Error(
      `Published page ${page.id} needs a single PublishedAt date`,
    );
  }
  const tags = page.properties.Tags;
  if (tags?.type !== "multi_select" || !Array.isArray(tags.multi_select)) {
    throw new Error(`Page ${page.id} has an invalid Tags property`);
  }
  const hero = page.properties.HeroImage;
  if (
    hero?.type !== "files" ||
    !Array.isArray(hero.files) ||
    hero.files.length > 1
  ) {
    throw new Error(`Page ${page.id} has an invalid HeroImage property`);
  }
  if (typeof page.last_edited_time !== "string")
    throw new Error(`Page ${page.id} has no edit time`);
  return {
    id: page.id,
    slug,
    title,
    description,
    publishedAt: date.date.start.slice(0, 10),
    updatedAt: page.last_edited_time,
    tags: tags.multi_select.map((tag) => tag.name),
    heroUrl: hero.files.length ? fileUrl(hero.files[0]) : null,
  };
}

export function publishedSnapshot(pages) {
  return pages
    .map(publicPost)
    .filter(Boolean)
    .map(({ id, slug, updatedAt }) => ({ id, slug, updatedAt }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function walk(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) walk(child, visitor);
}

export async function rewriteMarkdownImages(markdown, download) {
  const tree = unified().use(remarkParse).parse(markdown);
  const images = [];
  walk(tree, (node) => {
    if (node.type === "html" && !/^<br\s*\/?\s*>$/i.test(node.value.trim())) {
      throw new Error(
        "Notion markdown contains unsupported HTML or a custom block",
      );
    }
    if (node.type === "imageReference")
      throw new Error("Reference-style images are not supported");
    if (node.type === "image") {
      if (
        node.position?.start.offset === undefined ||
        node.position?.end.offset === undefined
      ) {
        throw new Error("Notion image has no source position");
      }
      images.push(node);
    }
  });
  const edits = [];
  for (const node of images) {
    const target = await download(node.url);
    const alt = (node.alt ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("]", "\\]");
    edits.push({
      start: node.position.start.offset,
      end: node.position.end.offset,
      text: `![${alt}](${target})`,
    });
  }
  let result = markdown;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

export function createImageDownloader({ directory, fetchImpl = fetch }) {
  const cached = new Map();
  return async function download(url) {
    if (cached.has(url)) return cached.get(url);
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Notion image URL is invalid");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("Notion image URL must be HTTPS");
    }
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error("Notion image download failed");
    }
    if (!response.ok)
      throw new Error(`Notion image download failed (${response.status})`);
    const mime = response.headers
      .get("content-type")
      ?.split(";")[0]
      .toLowerCase();
    const extension = IMAGE_EXTENSIONS.get(mime);
    if (!extension)
      throw new Error(`Unsupported Notion image type: ${mime ?? "missing"}`);
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_IMAGE_BYTES)
      throw new Error("Notion image exceeds the 10 MiB limit");
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > MAX_IMAGE_BYTES)
        throw new Error("Notion image exceeds the 10 MiB limit");
      chunks.push(Buffer.from(chunk));
    }
    const contents = Buffer.concat(chunks);
    if (!hasImageSignature(contents, mime))
      throw new Error("Notion image content does not match its type");
    const name = `${createHash("sha256").update(contents).digest("hex").slice(0, 20)}.${extension}`;
    await fs.writeFile(path.join(directory, name), contents);
    const localUrl = `/notion-images/${name}`;
    cached.set(url, localUrl);
    return localUrl;
  };
}

async function existingSlugs(rootDir) {
  const entries = await fs.readdir(path.join(rootDir, "src/content/blogs"), {
    withFileTypes: true,
  });
  const slugs = new Set();
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".md") ||
      entry.name.startsWith("notion--")
    )
      continue;
    slugs.add(entry.name.slice(0, -3));
    const source = await fs.readFile(
      path.join(rootDir, "src/content/blogs", entry.name),
      "utf8",
    );
    const customSlug = source.match(
      /^canonicalSlug:\s*['"]?([^'"\s]+)['"]?\s*$/m,
    )?.[1];
    if (customSlug) slugs.add(customSlug);
  }
  return slugs;
}

async function clearGeneratedPosts(targets) {
  for (const name of await fs.readdir(targets.posts)) {
    if (/^notion--[a-z0-9-]+\.md$/.test(name))
      await fs.rm(path.join(targets.posts, name));
  }
  await fs.rm(targets.snapshot, { force: true });
}

function markdownFile(post, body, heroImage) {
  const lines = [
    "---",
    `canonicalSlug: ${post.slug}`,
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `pubDate: ${post.publishedAt}`,
    `tags: ${JSON.stringify(post.tags)}`,
    "draft: false",
  ];
  if (heroImage) lines.push(`image: ${JSON.stringify(heroImage)}`);
  lines.push("---", "", body, "");
  return lines.join("\n");
}

export async function syncNotion({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const targets = pathsFor(rootDir);
  if (!shouldSync(env)) {
    await clearGeneratedPosts(targets);
    await fs.rm(targets.images, { recursive: true, force: true });
    return { skipped: true, count: 0 };
  }

  const notion = createNotionClient({
    token: env.NOTION_TOKEN,
    dataSourceId: env.NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID,
    fetchImpl,
  });
  const pages = await notion.pages();
  const posts = pages.map(publicPost).filter(Boolean);
  const usedSlugs = await existingSlugs(rootDir);
  for (const post of posts) {
    if (usedSlugs.has(post.slug))
      throw new Error(`Duplicate blog Slug: ${post.slug}`);
    usedSlugs.add(post.slug);
  }

  const stagingRoot = path.join(rootDir, ".astro");
  await fs.mkdir(stagingRoot, { recursive: true });
  const staging = await fs.mkdtemp(path.join(stagingRoot, "notion-stage-"));
  const stagedPosts = path.join(staging, "posts");
  const stagedImages = path.join(staging, "images");
  await Promise.all([fs.mkdir(stagedPosts), fs.mkdir(stagedImages)]);
  try {
    const download = createImageDownloader({
      directory: stagedImages,
      fetchImpl,
    });
    for (const post of posts) {
      const raw = await notion.markdown(post.id);
      const body = await rewriteMarkdownImages(raw, download);
      const heroImage = post.heroUrl ? await download(post.heroUrl) : null;
      await fs.writeFile(
        path.join(stagedPosts, `notion--${post.slug}.md`),
        markdownFile(post, body, heroImage),
      );
    }
    await clearGeneratedPosts(targets);
    await fs.rm(targets.images, { recursive: true, force: true });
    for (const name of await fs.readdir(stagedPosts)) {
      await fs.rename(
        path.join(stagedPosts, name),
        path.join(targets.posts, name),
      );
    }
    await fs.writeFile(
      targets.snapshot,
      JSON.stringify(publishedSnapshot(pages)),
    );
    await fs.mkdir(path.dirname(targets.images), { recursive: true });
    await fs.rename(stagedImages, targets.images);
    return { skipped: false, count: posts.length };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  syncNotion()
    .then(({ skipped, count }) => {
      console.log(
        skipped
          ? "Notion sync skipped for local or preview build"
          : `Prepared ${count} public Notion posts`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
