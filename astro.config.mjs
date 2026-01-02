// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import remarkToc from "remark-toc";
import remarkMath from "remark-math";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import rehypeKatex from "rehype-katex";
import icon from "astro-icon";
import pagefind from "astro-pagefind";

// https://astro.build/config
export default defineConfig({
  site: "https://me.niri.la",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [icon(), pagefind()],

  markdown: {
    remarkPlugins: [remarkMath, [remarkToc, { heading: "toc", maxDepth: 3 }]],
    rehypePlugins: [rehypeKatex, rehypeAccessibleEmojis],
  },
});
