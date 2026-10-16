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
// - every other subpath a package already declares, such as `./bootstrap` or `./icons/*`, and any
//   extra conditions on `.`, such as `import` or `node`, as written
// - `./package.json`, for tools that read it
// - `./*.js` and `./*`: deep imports such as `@onivoro/x/src/lib/foo.js` and, as CommonJS
//   consumers write them, `@onivoro/x/src/lib/foo`. TypeScript resolves both to the `.d.ts` beside
//   the `.js`. Only directory imports (`@onivoro/x/src/lib`) and files other than `.js` and
//   package.json stop resolving.
// `main` and `types` stay for TypeScript's legacy `node` resolution and older bundlers.
//
// --fix never drops, reorders or rewrites anything a package declares. It refuses, and names the
// conflict, when a manifest's `.` types or default disagree with its `types` and `main`, when its
// `.` conditions are in a different order from the standard one (types first, default last), when
// it maps `./package.json`, `./*.js` or `./*` elsewhere, or when it declares an `engines.node` that
// isn't a `>=` floor at or above the standard one.
'use strict';

const fs = require('fs');
const path = require('path');

// Node 22.16 is the floor the root package.json declares; CI builds and tests on Node 24. No upper
// bound, so Node 24 LTS and later install without engine warnings. A package may declare a higher
// `>=` floor of its own, such as `>=24`, and keeps it.
const ENGINES = { node: '>=22.16.0' };
const FLOOR = [22, 16, 0];

// `>=X`, `>=X.Y` or `>=X.Y.Z` at or above FLOOR. Anything else is for a person to decide.
function isStandardOrHigherFloor(range) {
  const match = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(
    String(range).trim(),
  );
  if (!match) return false;
  const version = match.slice(1).map((part) => Number(part ?? 0));
  for (let i = 0; i < 3; i++)
    if (version[i] !== FLOOR[i]) return version[i] > FLOOR[i];
  return true;
}

const STANDARD_SUBPATHS = {
  './package.json': './package.json',
  './*.js': './*.js',
  './*': './*.js',
};

const root = path.resolve(__dirname, '..');

function libraryDirs(base = root) {
  const libs = path.join(base, 'libs');
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

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// What the standard map would overwrite in the package's current one. Empty means
// standardExports(pkg) keeps everything the package declares.
function conflicts(pkg) {
  return [...engineConflicts(pkg), ...exportsConflicts(pkg)];
}

function engineConflicts(pkg) {
  const node = pkg.engines?.node;
  if (node === undefined || isStandardOrHigherFloor(node)) return [];
  return [
    `engines.node is ${JSON.stringify(node)}; use ${JSON.stringify(ENGINES.node)} or a higher ">=" floor`,
  ];
}

function exportsConflicts(pkg) {
  const current = pkg.exports;
  if (current === undefined) return [];
  if (
    !isObject(current) ||
    Object.keys(current).some((k) => !k.startsWith('.'))
  )
    return [
      'exports is not a subpath map (keys starting with "."); write it by hand',
    ];

  const found = [];
  const entry = current['.'];
  if (typeof entry === 'string') {
    if (entry !== pkg.main)
      found.push(
        `exports["."] is ${JSON.stringify(entry)}, but main is ${JSON.stringify(pkg.main)}`,
      );
  } else if (isObject(entry)) {
    if ('types' in entry && entry.types !== pkg.types)
      found.push(
        `exports["."].types is ${JSON.stringify(entry.types)}, but types is ${JSON.stringify(pkg.types)}`,
      );
    if ('default' in entry && entry.default !== pkg.main)
      found.push(
        `exports["."].default is ${JSON.stringify(entry.default)}, but main is ${JSON.stringify(pkg.main)}`,
      );
    // Condition order decides resolution (the first matching key wins), so the standard entry may
    // only add `types` and `default` around the declared conditions, never move any of them.
    const declared = Object.keys(entry);
    const standard = Object.keys(standardEntry(pkg)).filter((key) =>
      declared.includes(key),
    );
    if (declared.join() !== standard.join())
      found.push(
        `exports["."] conditions are in the order ${declared.join(', ')}; the standard order is ${standard.join(', ')} (types first, default last)`,
      );
    else if (!('types' in entry) && declared.some((key) => key !== 'default'))
      found.push(
        `exports["."] has conditions (${declared.join(', ')}) but no types; adding types first would change what TypeScript resolves`,
      );
  } else if (entry !== undefined) {
    found.push(`exports["."] is ${JSON.stringify(entry)}; write it by hand`);
  }
  for (const [key, target] of Object.entries(STANDARD_SUBPATHS)) {
    if (
      key in current &&
      JSON.stringify(current[key]) !== JSON.stringify(target)
    )
      found.push(
        `exports[${JSON.stringify(key)}] is ${JSON.stringify(current[key])}, but the standard map needs ${JSON.stringify(target)}`,
      );
  }
  return found;
}

// The standard `.` entry: types first, the declared conditions in their order, default last.
function standardEntry(pkg) {
  const current = isObject(pkg.exports) ? pkg.exports : {};
  const {
    types,
    default: _default,
    ...conditions
  } = isObject(current['.']) ? current['.'] : {};
  return { types: pkg.types, ...conditions, default: pkg.main };
}

// The standard map, keeping every condition and subpath the package already declares.
function standardExports(pkg) {
  const current = isObject(pkg.exports) ? pkg.exports : {};
  const declared = Object.fromEntries(
    Object.entries(current).filter(
      ([key]) => key !== '.' && !(key in STANDARD_SUBPATHS),
    ),
  );
  return {
    '.': standardEntry(pkg),
    ...declared,
    ...STANDARD_SUBPATHS,
  };
}

// Rebuilds the manifest with `exports` and `engines` right after `types`, keeping every other field
// in its place.
function withStandardFields(pkg) {
  const fields = {
    exports: standardExports(pkg),
    engines: {
      ...(pkg.engines || {}),
      node: pkg.engines?.node ?? ENGINES.node,
    },
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
  const clashes = conflicts(pkg);
  found.push(...clashes);
  if (
    !clashes.length &&
    JSON.stringify(pkg.exports) !== JSON.stringify(standardExports(pkg))
  )
    found.push('exports is not the standard map');
  if (pkg.engines?.node === undefined)
    found.push(
      `engines.node is missing; the standard is ${JSON.stringify(ENGINES.node)}`,
    );
  return found;
}

// Every file target of the non-wildcard subpaths, walking nested conditions and fallback arrays.
// Returns { targets, invalid }; `null` (an excluded subpath) is skipped.
function explicitTargets(exportsMap) {
  const targets = [];
  const invalid = [];
  const walk = (value, where) => {
    if (typeof value === 'string') targets.push(value);
    else if (value === null) return;
    else if (Array.isArray(value))
      value.forEach((v, i) => walk(v, `${where}[${i}]`));
    else if (isObject(value))
      for (const [condition, v] of Object.entries(value))
        walk(v, `${where}.${condition}`);
    else
      invalid.push(
        `${where} is ${JSON.stringify(value)}, not a path, condition object, array or null`,
      );
  };
  if (typeof exportsMap === 'string' || Array.isArray(exportsMap))
    walk(exportsMap, 'exports');
  else if (isObject(exportsMap))
    for (const [key, target] of Object.entries(exportsMap))
      if (!key.includes('*')) walk(target, `exports[${JSON.stringify(key)}]`);
  return { targets, invalid };
}

function run(mode, base = root, log = console) {
  let failed = 0;
  for (const rel of libraryDirs(base)) {
    const dir =
      mode === 'dist'
        ? path.join(base, 'dist', 'libs', rel)
        : path.join(base, 'libs', rel);
    const file = path.join(dir, 'package.json');
    const name = path.relative(base, file);
    if (!fs.existsSync(file)) {
      log.error(`${name}: missing (build first)`);
      failed++;
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

    if (mode === 'fix') {
      const clashes = conflicts(pkg);
      if (clashes.length) {
        for (const clash of clashes) log.error(`${name}: not fixed: ${clash}`);
        failed++;
        continue;
      }
      const next = withStandardFields(pkg);
      if (JSON.stringify(next) !== JSON.stringify(pkg)) {
        fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
        log.log(`updated ${name}`);
      }
      continue;
    }

    const found = problems(pkg);
    if (mode === 'dist') {
      const { targets, invalid } = explicitTargets(pkg.exports);
      found.push(...invalid);
      for (const target of targets)
        if (!fs.existsSync(path.join(dir, target)))
          found.push(`export target ${target} does not exist`);
    }
    for (const problem of found) log.error(`${name}: ${problem}`);
    if (found.length) failed++;
  }

  if (failed) {
    log.error(
      `\n${failed} package manifest(s) need attention.` +
        (mode === 'check' ? ' Run `npm run manifests:fix`.' : '') +
        (mode === 'fix'
          ? ' Resolve the conflicts by hand; nothing was dropped.'
          : ''),
    );
  } else if (mode !== 'fix') {
    log.log(
      `Every package manifest declares the standard exports and engines (${mode}).`,
    );
  }
  return failed;
}

module.exports = {
  ENGINES,
  conflicts,
  standardExports,
  withStandardFields,
  problems,
  explicitTargets,
  run,
};

if (require.main === module) {
  const mode = process.argv.includes('--fix')
    ? 'fix'
    : process.argv.includes('--dist')
      ? 'dist'
      : 'check';
  if (run(mode)) process.exit(1);
}
