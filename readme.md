# Releasing

Every `lib-server-*`, `lib-isomorphic-*` and `lib-browser-*` project is released together at one shared version (`projectsRelationship: "fixed"` in `nx.json`). Packages are built into `dist/` and published from there with public access.

## Before you start

- Be on `main` with a clean working tree.
- Log in to npm with `npm login`. A `.npmrc` in the repo root overrides your `~/.npmrc` login, so make sure there isn't a stale one.
- Have your npm authenticator ready; the account requires a one-time password to publish.

## Release

```bash
npm run release:minor                     # or release:patch / release:major
npm run release:publish -- --otp=<code>
npm run release:push
```

1. `release:minor` checks the branch, working tree and npm login, then runs `nx release version`. That bumps every package, updates the internal `@onivoro/*` dependency versions, commits `chore(release): v<version>` and tags `v<version>`. It then builds every package, so the next step only uploads.
2. `release:publish` publishes all packages. Pass a fresh one-time password; it expires in about 30 seconds.
3. `release:push` pushes `main` and the new release tag.

If a publish stops partway, for example because the one-time password expired, run `npm run release:publish -- --otp=<new code>` again. Versions already on npm are skipped.

## Previewing

```bash
npm run release:dry-run -- minor          # preview the version bump
npm run release:publish:dry-run           # preview what would be published
```
