import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNotionClient,
  pathsFor,
  publishedSnapshot,
  shouldSync,
} from "./notion-sync.mjs";

export async function verifyNotion({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const syncEnabled = shouldSync(env);
  const snapshot = syncEnabled
    ? JSON.parse(await fs.readFile(pathsFor(rootDir).snapshot, "utf8"))
    : [];
  await verifyOutput(rootDir, snapshot);
  if (!syncEnabled) return { skipped: true };
  const notion = createNotionClient({
    token: env.NOTION_TOKEN,
    dataSourceId:
      env.NOTION_DATA_SOURCE_ID || "3fc8b065-8d30-80a1-991f-000b80621903",
    fetchImpl,
  });
  const current = publishedSnapshot(await notion.pages());
  if (JSON.stringify(snapshot) !== JSON.stringify(current)) {
    throw new Error(
      "Notion publication changed during build; rerun to publish the latest state",
    );
  }
  return { skipped: false };
}

async function verifyOutput(rootDir, snapshot) {
  const dist = path.join(rootDir, "dist");
  for (const file of [
    "404.html",
    "blog/index.html",
    "blog/rss.xml",
    "pagefind/pagefind-entry.json",
  ]) {
    await fs.access(path.join(dist, file));
  }
  for (const { slug } of snapshot) {
    await fs.access(path.join(dist, "blog", slug, "index.html"));
  }
  const imageDir = pathsFor(rootDir).images;
  let images = [];
  try {
    images = await fs.readdir(imageDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const image of images) {
    await fs.access(path.join(dist, "notion-images", image));
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  verifyNotion()
    .then(({ skipped }) => {
      console.log(
        skipped ? "Notion verification skipped" : "Notion publication verified",
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
