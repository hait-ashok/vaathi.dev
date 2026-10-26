import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    path: z.enum(['foundations', 'build']),
    minutes: z.number(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { lessons };
