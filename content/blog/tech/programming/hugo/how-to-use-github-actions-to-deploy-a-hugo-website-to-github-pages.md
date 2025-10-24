+++
date = '2025-10-23'
title = 'How to use Github Actions to Deploy a Hugo Website to GitHub Pages automatically'
description = "In this post, I'll walk you through a complete GitHub Actions workflow for building and deploying a Hugo static website to GitHub Pages. This setup is ideal for developers who want a free, automated hosting solution for their blogs, documentation sites, or portfolios. It replaces manual uploads with a push-to-deploy pipeline."
tags = ['Tech', 'Programming', 'Hugo', 'github']
draft = false
+++
In this post, I'll walk you through a complete GitHub Actions workflow for building and deploying a Hugo static website to GitHub Pages. This setup is ideal for developers who want a free, automated hosting solution for their open source projects, blogs, documentation sites, or portfolios. It replaces manual uploads with a push to deploy pipeline.

The workflow triggers on pushes to the main branch (or manually via the Actions tab), builds your Hugo site using Node.js for any custom scripts, and deploys the output to GitHub Pages. It's efficient, secure, and leverages official GitHub Actions for reliability.

## Prerequisites

- A Hugo website in a GitHub repository
- GitHub Pages enabled for the repository (go to Settings > Pages and then select "GitHub Actions" as the source)

### Example of a setup for some software I released as open source.
!["GitHub Pages with custom domain setup"](/assets/img/blog/tech/programming/hugo/github-pages-custom-domain.webp)

## Setting Up the Workflow

Create a new file in your repository at `.github/workflows/deploy.yml`. 

Here's the YAML configuration for the workflow:
```yaml
name: Deploy Hugo Website to GitHub Pages

on:
  push:
    branches: [ main ]
    
  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v5

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: 'latest'
          extended: true

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 'latest'
          cache: 'npm'  # Optional: Cache npm deps for faster runs

      - name: Install NPM packages
        run: npm ci  # Use 'ci' for cleaner installs in CI

      - name: Build Hugo site
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
This workflow triggers on pushes to the `main` branch. It sets up Hugo and Node.js, installs dependencies, builds the site. If the build is successful then then deploy job will run and deploy the built Hugo website to GitHub Pages.

## Additional Steps

- Ensure your repository has GitHub Pages enabled.
- If using a custom domain, add a `CNAME` record for your domain as per the GitHub Pages instructions.
- The workflow assumes your build command is `npm run build` and outputs to `./public`. Adjust if necessary.

## Conclusion
Automating your Hugo website deployment with GitHub Actions and GitHub Pages streamlines your workflow, ensuring fast and reliable updates. By leveraging GitHub's built in CI/CD capabilities, you can focus on content creation while the deployment happens automatically. This setup not only saves time but also provides peace of mind with version controlled, reproducible deployments.
