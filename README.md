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

## Deploy (AWS)

**Canonical URL:** `https://vaathi.dev` (`site` in `astro.config.mjs`). `www` redirects to apex (CloudFront Function in the infra repo).

Infrastructure is **Terraform in a separate repo:** [`hait-ashok/vaathi-dev-infra`](https://github.com/hait-ashok/vaathi-dev-infra). This app: [`hait-ashok/vaathi.dev`](https://github.com/hait-ashok/vaathi.dev). Architecture: Project store `docs/aws-infra-architecture.md`.

### CI (this repo)

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

1. Apply infra; copy Terraform output `github_actions_vars` into this repo’s **Actions variables**:
   - `AWS_REGION`
   - `AWS_DEPLOY_ROLE_ARN`
   - `AWS_S3_BUCKET`
   - `AWS_CLOUDFRONT_DISTRIBUTION_ID`
2. Push to `main` (or **Run workflow**). Actions builds `dist/`, syncs to S3 via **OIDC** (no long-lived keys), invalidates CloudFront.

### Manual publish (break-glass)

```bash
npm ci && npm run build
aws s3 sync dist/ s3://BUCKET --delete
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

Use bucket / distribution IDs from `terraform output` in `~/vaathi-dev-infra`.
