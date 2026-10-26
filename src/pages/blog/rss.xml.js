import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { blogSlug } from "../../blogSlug";

export async function GET(context) {
  const posts = await getCollection("blogs", ({ data }) => !data.draft);

  return rss({
    // `<title>` field in output xml
    title: "niri.la Blog",
    // `<description>` field in output xml
    description: "nirilaのブログ",
    // Pull in your project "site" from the endpoint context
    // https://docs.astro.build/en/reference/api-reference/#site
    site: context.site,
    // Array of `<item>`s in output xml
    // See "Generating items" section for examples using content collections and glob imports
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/blog/${blogSlug(post)}/`,
      }))
      .slice(0, 20),
    // (optional) inject custom xml
    customData: `<language>ja-jp</language>`,
  });
}
