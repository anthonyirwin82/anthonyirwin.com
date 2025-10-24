+++
title = "How to use GitHub Actions Workflow to Deploy Your Website using rsync automatically"
description = "Learn how to automate your Hugo website deployment with GitHub Actions and rsync for fast, secure updates."
date = 2025-10-24
tags = ['tech', 'programming', 'hugo', 'github', 'rsync']
draft = false
+++

## Introduction

GitHub Actions is a powerful automation tool built into GitHub that allows you to create custom workflows for building, testing, and deploying your code. Instead of manually deploying your Hugo website every time you push changes, you can set up a workflow that automatically builds and deploys your site using rsync over SSH. This not only saves time but also reduces the risk of human error and ensures consistent deployments.

Why use GitHub Actions for deployment? It integrates seamlessly with your Git repository, triggers on events like pushes to the main branch, and provides a secure way to handle sensitive information like SSH keys through secrets. For static sites like Hugo, rsync is an efficient choice as it only transfers changed files, making deployments fast and bandwidth friendly.

## Basics of GitHub Actions YAML Configuration

GitHub Actions workflows are defined in YAML files stored in the `.github/workflows/` directory of your repository. Here's a quick overview of the key components:

- **name**: A descriptive name for your workflow.
- **on**: Specifies when the workflow should run (e.g., on push to specific branches).
- **jobs**: Defines the tasks to perform, each running on a virtual machine.
- **steps**: Individual actions within a job, which can be predefined actions or custom shell commands.

Workflows use a runner (like `ubuntu-latest`) and can include steps like checking out code, setting up environments, running commands, and deploying.

## Example Workflow: Deploying Hugo with Rsync

Let's examine a complete workflow that builds a Hugo site and deploys it via rsync.

```yaml
name: Deploy Hugo Website via RSync

on:
  push:
    branches: [ main ]
  
  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

jobs:
  deploy:
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
        run: npm ci # better on CI deployments then npm install
        run: npm run build

      - name: Setup SSH key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy Website via RSync
        run: rsync -avz --delete -e "ssh -i ~/.ssh/id_ed25519" public/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.SSH_DEST }}
```

This workflow triggers on pushes to the `main` branch. It sets up Hugo and Node.js, installs dependencies, builds the site, configures SSH, and deploys to your server using rsync.

## SSH Deployment with GitHub Actions: A Step by Step Breakdown

1. `echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519`

- **What it does:** Writes the SSH private key from GitHub Secrets to a local file named `id_ed25519` in the `.ssh` directory.
- **Why:** This is needed for authentication when connecting to the remote server via SSH.

2. `ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts`

- **What it does:** Fetches the host key of the remote server and appends it to your local `known_hosts` file.
- **Why:** This ensures that your local machine trusts the remote server, preventing "Host key verification failed" errors.

3. `rsync -avz --delete -e "ssh -i ~/.ssh/id_ed25519" public/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.SSH_DEST }}`

- **What it does:** Uses the SSH key to copy your local `public/` directory to a remote server.
- **Key options:**
  - `-a`: Archive mode copies recursively and preserves permissions, timestamps, symlinks, etc
  - `-v`: Verbose output
  - `-z`: Compress data during transfer
  - `--delete`: Delete files on the remote server that don't exist locally
  - `-e "ssh -i ~/.ssh/id_ed25519"`: Specify the SSH command to use with the private key created from the `secrets.SSH_PRIVATE_KEY`

## Setting Up SSH Keys and GitHub Secrets

To securely deploy via SSH, you need to set up SSH key authentication and store sensitive information as GitHub secrets.

### Generate SSH Key Pair

First, generate an Ed25519 SSH key pair on your local machine:

```bash
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/github-actions-deploy
```
> [!IMPORTANT]
> You should not use a passphrase or password with the ssh key so that you can use it from a script without requiring a password to be entered.

This creates two files: `github-actions-deploy` (private key) and `github-actions-deploy.pub` (public key).

### Add Public Key to Server

Copy the public key to your server's `~/.ssh/authorized_keys` file:

```bash
ssh-copy-id -i ~/.ssh/github-actions-deploy.pub user@your-server.com
```

### Configure GitHub Secrets

> [!IMPORTANT]
> This section is for the settings of the GitHub repository not the global GitHub Settings

In your GitHub repository, go to Settings > Secrets and variables > Actions and add these secrets:

- **SSH_PRIVATE_KEY**: The entire contents of your private key file (`github-actions-deploy`)
- **SSH_HOST**: Your server's hostname or IP address
- **SSH_USER**: The SSH username for deployment
- **SSH_DEST**: The destination path on the server (e.g., `/var/www/html`)

The workflow uses these secrets to authenticate and deploy securely without exposing credentials.

## Conclusion

Automating your Hugo website deployment with GitHub Actions and rsync streamlines your workflow, ensuring fast and reliable updates. By leveraging GitHub's built in CI/CD capabilities, you can focus on content creation while the deployment happens automatically. Remember to keep your secrets secure and test your workflow thoroughly before relying on it for production deployments. This setup not only saves time but also provides peace of mind with version controlled, reproducible deployments.
