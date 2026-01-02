import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updateDate: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

export const collection = {
  blog: blogCollection,
};
