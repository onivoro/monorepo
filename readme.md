# Releasing

Every `lib-server-*`, `lib-isomorphic-*` and `lib-browser-*` project is released together at one shared version (`projectsRelationship: "fixed"` in `nx.json`). Packages are built into `dist/` and published from there with public access.

Publishing happens in GitHub Actions (`.github/workflows/publish.yml`) through npm trusted publishing, so every package gets a provenance attestation and no npm token is stored anywhere. The workflow runs on every push to `main` and publishes only when the shared version isn't on npm yet, so a push without a version bump does nothing.

The workflow has two jobs:

- `build` installs with `npm ci --ignore-scripts`, builds every package and uploads `dist/libs`. It has read-only repo access and can't get an npm token.
- `publish` runs in the `npm-publish` GitHub environment. It downloads the build, installs and checks out nothing, and runs `npm publish --provenance` for each version not on npm yet. It's the only job allowed to request the short-lived npm token.

The `npm-publish` environment accepts only `main` and waits for an approval, and every package trusts only this workflow in that environment. A run from any other branch, from an edited copy of the workflow there, or from a fork can't publish.

## Release

Be on `main` with a clean working tree.

```bash
npm run release:minor                     # or release:patch / release:major
npm run release:push
```

1. `release:minor` checks the branch and working tree, then runs `nx release version`. That bumps every package, updates the internal `@onivoro/*` dependency versions, commits `chore(release): v<version>` and tags `v<version>`. It then builds every package locally, so a broken build fails before anything is pushed.
2. `release:push` pushes `main` and the new release tag. The push starts `publish.yml`, which builds every package.
3. Approve the `publish` job: open the run in the Actions tab and choose "Review deployments". It then publishes every package.

If a publish fails partway, rerun the failed job from the Actions tab (the workflow also has a manual "Run workflow" button). Versions already on npm are skipped.

## Trusted publishing setup

Each package on npm must trust `publish.yml` in `onivoro/monorepo`, run in the `npm-publish` environment. Set this up once, and again for each new library after its first publish (npm can only add trust to a package that already exists):

```bash
npm login
npm run release:trust                     # pass -- --dry-run to preview
```

`release:trust` runs `npm trust github` for every package that doesn't trust the workflow yet. npm asks for a one-time password for each package it changes.

A brand-new package has to be published once by hand: `npm run release:publish -- --otp=<code>` publishes whatever isn't on npm yet.

Once a package trusts the workflow, set its npm publishing access to "Require two-factor authentication and disallow tokens", so a leaked npm token can't publish it. Trusted publishing still works.

## Repository settings

`publish.yml` relies on these GitHub settings for `onivoro/monorepo`:

- **`npm-publish` environment**: deployment branches limited to `main`, with a required reviewer.
- **`main` ruleset**: blocks deleting and force-pushing `main`. Direct pushes, which `release:push` needs, still work.
- **Actions**: only GitHub-owned actions are allowed, they must be pinned to full commit SHAs, and the default `GITHUB_TOKEN` is read-only. To update an action, replace both the SHA and the version comment beside it.

## Previewing

```bash
npm run release:dry-run -- minor          # preview the version bump
npm run release:publish:dry-run           # preview what would be published
```
