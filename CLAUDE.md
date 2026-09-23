# CLAUDE.md

Nx monorepo of publishable `@onivoro/*` libraries, grouped by runtime: `libs/server` (NestJS), `libs/browser` (React), `libs/isomorphic` (both). Project names follow `lib-<runtime>-<name>` (e.g. `lib-server-common`); `apps/cli` holds tooling.

## Commands

```bash
npm run fmt                  # format (required before commits)
npm run test                 # all unit tests
npx nx test {project}
npx nx build {project}
npx nx run-many -t build
```

## Releasing

All libraries release together at one version. Run on a clean `main`, logged in to npm; see `readme.md` for details.

```bash
npm run release:minor                     # or release:patch / release:major: version, commit, tag, build
npm run release:publish -- --otp=<code>   # publish to npm (the account requires a one-time password)
npm run release:push                      # push main and the release tag
```

`nx release version` commits and tags on its own (`release.version.git` in `nx.json`), so never commit or tag a release by hand.

## React code in apps/browser/

- Use `@mui/material` and `@mui/icons-material`, not other component or icon libraries.
- Style with the `sx` prop or MUI's theme and `styled` API. No styled-components, Tailwind, other CSS-in-JS, or stylesheet CSS rules.
- Never set `color` or `backgroundColor` in `sx`, including pseudo states; use theme palette variants.
- State: Redux Toolkit (`createSlice`, `createAsyncThunk`, `configureStore`). No RTK Query, and no other state libraries or Context for global state unless asked.
- Name `useContext` results `const [foo, fooAs] = useContext('whatever');`.
