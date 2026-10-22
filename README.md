# vaathi.dev

Free foundational AI skills for beginners — **curiosity begins here.**

Local static site (Astro + MDX). Domain DNS, AWS (S3/CloudFront), and GitHub remote are deferred until this local MVP is solid.

**License:** [MIT](./LICENSE) — Copyright © 2026 H&A IT.  
**Attribution:** Powered by [H&A IT](https://www.haitsolutions.co.uk) · [info@haitsolutions.co.uk](mailto:info@haitsolutions.co.uk)

## Requirements

- Node.js **≥ 22.23.4** (see `.nvmrc`)

```bash
nvm use   # if you use nvm
```

## Develop

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:4321`).

## Build

```bash
npm run build
npm run preview   # optional: serve dist/ locally
```

Static output lands in `dist/`.

## Content

- Lessons: `src/content/lessons/*.mdx`
- Frontmatter: `title`, `description`, `order`, `path`, `minutes`, `draft`
- Design tokens: `src/styles/tokens.css` (mist / teal / cobalt)

## Deploy (later)

Not configured yet. When ready: private S3 + CloudFront (OAC), custom domain owned by H&A, CI from a GitHub remote. See Project store docs: `implementation-tasks.md` Phases 4–6.
