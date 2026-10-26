import type { CollectionEntry } from "astro:content";

export function blogSlug(post: CollectionEntry<"blogs">): string {
  return post.data.canonicalSlug ?? post.id.replace(/\.md$/, "");
}
