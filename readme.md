# Releasing

Every `lib-server-*`, `lib-isomorphic-*` and `lib-browser-*` project is released together at one shared version (`projectsRelationship: "fixed"` in `nx.json`). Packages are built into `dist/` and published from there with public access.

Publishing happens in GitHub Actions (`.github/workflows/publish.yml`) through npm trusted publishing, so every package gets a provenance attestation and no npm token is stored anywhere. The workflow runs when a `v<version>` release tag is pushed. Pushes to `main` or any other branch never publish.

The workflow has two jobs:

- `build` first checks that the tag matches every package's version and points at a commit on `main`. It then installs with `npm ci --ignore-scripts`, builds every package and uploads `dist/libs`. It has read-only repo access and can't get an npm token.
- `publish` runs in the `npm-publish` GitHub environment. It downloads the build, installs and checks out nothing, and runs `npm publish --provenance` for each version not on npm yet. It's the only job allowed to request the short-lived npm token.

Only repository admins can create `v*` tags, the `npm-publish` environment accepts only `v*` tags, and every package trusts only this workflow in that environment. A run from a branch, from an edited copy of the workflow, or from a fork can't publish.

## Release

Be on `main` with a clean working tree.

```bash
npm run release:minor                     # or release:patch / release:major
npm run release:push
```

1. `release:minor` checks that you're on `main` with a clean working tree that matches `origin/main`. It lists every commit since the last release tag, and every change to build, release and dependency files, and asks you to confirm, because the release publishes all of it. It then runs `nx release version`. That bumps every package, updates the internal `@onivoro/*` dependency versions, commits `chore(release): v<version>` and tags `v<version>`. It then builds every package locally, so a broken build fails before anything is pushed.
2. `release:push` pushes `main` and the new release tag together: if either is rejected, neither is pushed. The tag starts `publish.yml`, which builds and publishes every package.

If a publish fails partway, rerun the failed job from the Actions tab. Versions already on npm are skipped.

## Trusted publishing setup

Each package on npm must trust `publish.yml` in `onivoro/monorepo`, run in the `npm-publish` environment. Set this up once, and again for each new library after its first publish (npm can only add trust to a package that already exists):

```bash
npm login
npm run release:trust                     # pass -- --dry-run to preview, or -- @onivoro/<name> for one package
```

`release:trust` runs `npm trust github` for every package that doesn't trust the workflow yet. It then sets every package to "Require two-factor authentication and disallow tokens" (`npm access set mfa=publish`), so a leaked npm token can't publish it; trusted publishing still works. Finally it lists the npm org's members and your npm tokens for you to review. npm asks for a one-time password for each change.

A brand-new package needs a few extra steps before CI can publish it; see [Adding a package](#adding-a-package).

## Adding a package

CI can't publish a package that doesn't exist on npm yet, because npm only accepts trust settings for an existing package. Bootstrap each new package once, between merging it and the next release. If a release tag is pushed first, the `publish` job fails on the new package.

### 1. Create the library

Copy an existing library from the same runtime folder, for example `libs/server/mcp-oauth`, and rename every path and name in it.

- **`project.json`**: `name` must be `lib-<runtime>-<name>`, such as `lib-server-foo`, so `nx release` includes it in the shared version. Keep the `build` target's `outputPath` at `dist/libs/<runtime>/<name>`, and keep the `nx-release-publish` target.
- **`package.json`** needs:
  - `name`: `@onivoro/<runtime>-<name>`.
  - `version`: the current shared version. Copy it from `libs/server/common/package.json`. `publish.yml` refuses a release tag that doesn't match every package's version.
  - `repository`: `{ "type": "git", "url": "https://github.com/onivoro/monorepo.git" }`. Provenance fails without it.
  - `license`, `main`, `types` and `files`, as in the library you copied.
- **`tsconfig.base.json`**: add the `@onivoro/<runtime>-<name>` path mapping.

Nothing in `publish.yml` or `.github/CODEOWNERS` needs changing, because both match every `libs/*/*/package.json`.

### 2. Merge it

Open a pull request. CODEOWNERS asks for your review because the change adds a `package.json` and `project.json`.

### 3. Publish the first version by hand

On an up-to-date `main`, logged in to npm, publish only the new package at the current shared version:

```bash
npm login
npx nx release publish --projects=lib-<runtime>-<name> --otp=<code>
```

This version is published from your machine, so it has no provenance attestation. Every later version comes from CI and has one.

### 4. Trust the workflow

Run this in your own terminal app, because npm only asks for two-factor approval in an interactive terminal:

```bash
npm run release:trust -- @onivoro/<runtime>-<name>
```

Naming the package limits the run to it: approve reading its trust settings, adding trust, and setting it to two-factor-only publishing. Without a name the script walks all packages and asks for about three approvals each.

### 5. Release as usual

`npm run release:minor` and `npm run release:push`. CI now publishes the new package with the others.

## Checks

`.github/workflows/ci.yml` runs on every pull request into `main` and on `main` after each merge. It checks the formatting of the changed files (`nx format:check`), runs every project's unit tests, and builds every published library. Like `publish.yml`, it installs with no install scripts, has a read-only token and no secrets, and pins its actions to commit SHAs. The checks are not yet required for merging. The Nest 11 smoke test (`npm run smoke:nest11`) runs only locally.

## Repository settings

`publish.yml` relies on these GitHub settings for `onivoro/monorepo`. `npm run release:github-settings` applies them (as a repo admin with `gh` logged in) and can be run again at any time:

- **`npm-publish` environment**: deployments limited to `v*` tags.
- **`release tags` ruleset**: only repository admins can create, move or delete `v*` tags.
- **`main` ruleset**: blocks deleting and force-pushing `main`, and requires a pull request with one approval, plus code owner review for the build and release files in `.github/CODEOWNERS`. Admins can bypass it, which `release:push` needs.
- **Actions**: only GitHub-owned actions are allowed, they must be pinned to full commit SHAs, and the default `GITHUB_TOKEN` is read-only. Dependabot (`.github/dependabot.yml`) opens a weekly pull request that updates the pinned SHAs and their version comments.
- **Security**: secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting (see `SECURITY.md`).

Two settings the script can't apply:

- **Org 2FA**: require two-factor authentication at https://github.com/organizations/onivoro/settings/security.
- **Admins**: every repository admin can create release tags, so every admin can publish. Keep everyone else at write access or lower.

## Previewing

```bash
npm run release:dry-run -- minor          # preview the version bump
npm run release:publish:dry-run           # preview what would be published
```
