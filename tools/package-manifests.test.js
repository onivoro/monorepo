// Run with `npm run manifests:test` (node --test).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ENGINES,
  conflicts,
  standardExports,
  withStandardFields,
  explicitTargets,
  run,
} = require('./package-manifests');

const base = {
  name: '@onivoro/server-fixture',
  version: '1.0.0',
  type: 'commonjs',
  main: './src/index.js',
  types: './src/index.d.ts',
};

const quiet = () => {
  const lines = { log: [], error: [] };
  return {
    lines,
    log: (m) => lines.log.push(m),
    error: (m) => lines.error.push(m),
  };
};

const workspaces = [];
test.after(() => {
  for (const dir of workspaces)
    fs.rmSync(dir, { recursive: true, force: true });
});

// A workspace with libs/server/fixture/package.json (and, optionally, its dist copy)
function workspace(pkg, distFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-manifests-'));
  workspaces.push(dir);
  const lib = path.join(dir, 'libs', 'server', 'fixture');
  fs.mkdirSync(lib, { recursive: true });
  fs.writeFileSync(
    path.join(lib, 'package.json'),
    JSON.stringify(pkg, null, 2),
  );
  if (distFiles) {
    const dist = path.join(dir, 'dist', 'libs', 'server', 'fixture');
    for (const file of distFiles) {
      fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
      fs.writeFileSync(path.join(dist, file), '');
    }
    fs.writeFileSync(
      path.join(dist, 'package.json'),
      JSON.stringify(pkg, null, 2),
    );
  }
  return dir;
}

const read = (dir) =>
  JSON.parse(
    fs.readFileSync(
      path.join(dir, 'libs', 'server', 'fixture', 'package.json'),
      'utf8',
    ),
  );

test('a package with no exports gets the standard map and engines after types', () => {
  const out = withStandardFields({ ...base, files: ['**/*.js'] });
  assert.deepEqual(Object.keys(out), [
    'name',
    'version',
    'type',
    'main',
    'types',
    'exports',
    'engines',
    'files',
  ]);
  assert.deepEqual(out.exports, {
    '.': { types: './src/index.d.ts', default: './src/index.js' },
    './package.json': './package.json',
    './*.js': './*.js',
    './*': './*.js',
  });
  assert.deepEqual(out.engines, ENGINES);
});

test('fix keeps extra conditions on "." and every declared subpath, wildcards included', () => {
  const pkg = {
    ...base,
    exports: {
      '.': {
        types: './src/index.d.ts',
        import: './esm/index.mjs',
        require: './src/index.js',
        default: './src/index.js',
      },
      './bootstrap': {
        types: './src/bootstrap.d.ts',
        default: './src/bootstrap.js',
      },
      './icons/*': './icons/*.svg',
      './internal/*': null,
    },
  };
  const exportsMap = standardExports(pkg);
  assert.deepEqual(exportsMap['.'], pkg.exports['.']);
  assert.deepEqual(Object.keys(exportsMap['.']), [
    'types',
    'import',
    'require',
    'default',
  ]);
  assert.deepEqual(exportsMap['./bootstrap'], pkg.exports['./bootstrap']);
  assert.equal(exportsMap['./icons/*'], './icons/*.svg');
  assert.equal(exportsMap['./internal/*'], null);
  assert.equal(exportsMap['./*'], './*.js');
  assert.deepEqual(conflicts(pkg), []);

  const dir = workspace(pkg);
  const log = quiet();
  assert.equal(run('fix', dir, log), 0);
  assert.deepEqual(read(dir).exports, exportsMap);
  assert.equal(run('check', dir, quiet()), 0);
});

test('fix refuses, and changes nothing, when it would overwrite a declared target', () => {
  const cases = [
    { '.': './dist/other.js' },
    { '.': { types: './other.d.ts', default: './src/index.js' } },
    { '.': { types: './src/index.d.ts', default: './esm/index.mjs' } },
    { '.': {}, './*': './src/*.js' },
    { '.': {}, './*.js': null },
    { '.': {}, './package.json': null },
  ];
  for (const exportsMap of cases) {
    const pkg = { ...base, exports: exportsMap };
    assert.ok(conflicts(pkg).length, JSON.stringify(exportsMap));
    const dir = workspace(pkg);
    const log = quiet();
    assert.equal(run('fix', dir, log), 1);
    assert.deepEqual(read(dir), pkg);
    assert.match(log.lines.error.join('\n'), /not fixed/);
    assert.equal(run('check', dir, quiet()), 1);
  }
});

test('a non-subpath exports value is a conflict, not a crash', () => {
  assert.ok(conflicts({ ...base, exports: './src/index.js' }).length);
  assert.ok(
    conflicts({ ...base, exports: { import: './a.mjs', require: './a.js' } })
      .length,
  );
});

test('explicitTargets walks nested conditions and fallback arrays, skipping wildcards and null', () => {
  const { targets, invalid } = explicitTargets({
    '.': {
      node: { types: './src/index.d.ts', default: './src/index.js' },
      default: './src/browser.js',
    },
    './a': ['./src/a.js', { default: './src/a-fallback.js' }],
    './gone': null,
    './*': './*.js',
  });
  assert.deepEqual(targets, [
    './src/index.d.ts',
    './src/index.js',
    './src/browser.js',
    './src/a.js',
    './src/a-fallback.js',
  ]);
  assert.deepEqual(invalid, []);
});

test('explicitTargets reports values that are not targets', () => {
  const { invalid } = explicitTargets({
    '.': { types: './src/index.d.ts', default: 42 },
  });
  assert.deepEqual(invalid, [
    'exports["."].default is 42, not a path, condition object, array or null',
  ]);
});

test('--dist checks nested condition targets instead of throwing', () => {
  const pkg = withStandardFields({
    ...base,
    exports: {
      '.': {
        types: './src/index.d.ts',
        node: { types: './src/node.d.ts', default: './src/node.js' },
        default: './src/index.js',
      },
    },
  });

  const complete = workspace(pkg, [
    'src/index.js',
    'src/index.d.ts',
    'src/node.js',
    'src/node.d.ts',
  ]);
  assert.equal(run('dist', complete, quiet()), 0);

  const missing = workspace(pkg, ['src/index.js', 'src/index.d.ts']);
  const log = quiet();
  assert.equal(run('dist', missing, log), 1);
  assert.match(
    log.lines.error.join('\n'),
    /export target \.\/src\/node\.js does not exist/,
  );
});
