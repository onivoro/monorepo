#!/usr/bin/env node
// Keeps every published library's package.json declaring the same `engines` and a conservative
// `exports` map. Each libs/<runtime>/<name>/package.json is copied into dist by the build, so
// what this script writes is what npm publishes.
//
//   node tools/package-manifests.js           check every libs/*/*/package.json (CI runs this)
//   node tools/package-manifests.js --fix     write the standard fields into them
//   node tools/package-manifests.js --dist    check the built packages in dist/libs: the fields are
//                                             there and every explicit export target exists
//
// The exports map keeps every import that works without one working:
// - `.`: the package entry, with `types` first for TypeScript's node16, nodenext and bundler modes
// - any explicit subpaths a package already declares, such as `./bootstrap`
// - `./package.json`, for tools that read it
// - `./*.js` and `./*`: deep imports such as `@onivoro/x/src/lib/foo.js` and, as CommonJS
//   consumers write them, `@onivoro/x/src/lib/foo`. TypeScript resolves both to the `.d.ts` beside
//   the `.js`. Only directory imports (`@onivoro/x/src/lib`) and files other than `.js` and
//   package.json stop resolving.
// `main` and `types` stay for TypeScript's legacy `node` resolution and older bundlers.
'use strict';

const fs = require('fs');
const path = require('path');

// Node 22.16 is the floor the monorepo builds and tests on (root package.json); no upper bound, so
// Node 24 LTS and later install without engine warnings.
const ENGINES = { node: '>=22.16.0' };

const root = path.resolve(__dirname, '..');
const mode = process.argv.includes('--fix')
  ? 'fix'
  : process.argv.includes('--dist')
    ? 'dist'
    : 'check';

function libraryDirs() {
  const libs = path.join(root, 'libs');
  return fs
    .readdirSync(libs)
    .flatMap((runtime) => {
      const dir = path.join(libs, runtime);
      return fs.statSync(dir).isDirectory()
        ? fs.readdirSync(dir).map((name) => path.join(runtime, name))
        : [];
    })
    .filter((rel) => fs.existsSync(path.join(libs, rel, 'package.json')))
    .sort();
}

function standardExports(pkg) {
  const entry = { types: pkg.types, default: pkg.main };
  const explicit = Object.fromEntries(
    Object.entries(pkg.exports || {}).filter(
      ([key]) => key !== '.' && key !== './package.json' && !key.includes('*'),
    ),
  );
  return {
    '.': entry,
    ...explicit,
    './package.json': './package.json',
    './*.js': './*.js',
    './*': './*.js',
  };
}

// Rebuilds the manifest with `exports` and `engines` right after `types`, keeping every other field
// in its place.
function withStandardFields(pkg) {
  const fields = {
    exports: standardExports(pkg),
    engines: { ...(pkg.engines || {}), ...ENGINES },
  };
  const out = {};
  for (const [key, value] of Object.entries(pkg)) {
    if (key in fields) continue;
    out[key] = value;
    if (key === 'types') Object.assign(out, fields);
  }
  if (!('exports' in out)) Object.assign(out, fields);
  return out;
}

function problems(pkg) {
  const found = [];
  if (pkg.type !== 'commonjs')
    found.push(`type is ${JSON.stringify(pkg.type)}, expected "commonjs"`);
  if (!pkg.main || !pkg.types) found.push('main and types are both required');
  if (JSON.stringify(pkg.exports) !== JSON.stringify(standardExports(pkg)))
    found.push('exports is not the standard map');
  if (pkg.engines?.node !== ENGINES.node)
    found.push(`engines.node is not ${JSON.stringify(ENGINES.node)}`);
  return found;
}

function explicitTargets(exportsMap) {
  return Object.entries(exportsMap)
    .filter(([key]) => !key.includes('*'))
    .flatMap(([, target]) =>
      typeof target === 'string' ? [target] : Object.values(target),
    );
}

let failed = 0;
for (const rel of libraryDirs()) {
  const dir =
    mode === 'dist'
      ? path.join(root, 'dist', 'libs', rel)
      : path.join(root, 'libs', rel);
  const file = path.join(dir, 'package.json');
  if (!fs.existsSync(file)) {
    console.error(`${path.relative(root, file)}: missing (build first)`);
    failed++;
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (mode === 'fix') {
    const next = withStandardFields(pkg);
    if (JSON.stringify(next) !== JSON.stringify(pkg)) {
      fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
      console.log(`updated ${path.relative(root, file)}`);
    }
    continue;
  }

  const found = problems(pkg);
  if (mode === 'dist') {
    for (const target of explicitTargets(pkg.exports || {})) {
      if (!fs.existsSync(path.join(dir, target)))
        found.push(`export target ${target} does not exist`);
    }
  }
  for (const problem of found)
    console.error(`${path.relative(root, file)}: ${problem}`);
  if (found.length) failed++;
}

if (failed) {
  console.error(
    `\n${failed} package manifest(s) need attention.` +
      (mode === 'check' ? ' Run `npm run manifests:fix`.' : ''),
  );
  process.exit(1);
}
if (mode !== 'fix')
  console.log(
    `Every package manifest declares the standard exports and engines (${mode}).`,
  );
