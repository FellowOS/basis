import { defineConfig, defineDocs, frontmatterSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

const productDocFrontmatterSchema = frontmatterSchema.extend({
  sidebarTitle: z.string().optional(),
});

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: productDocFrontmatterSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      addLanguageClass: true,
    },
  },
});
