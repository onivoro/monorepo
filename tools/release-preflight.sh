#!/usr/bin/env bash
# Run by release:patch/minor/major before anything is versioned. Releases exactly what is on
# origin/main, after showing every commit since the last release for you to confirm, since the
# release tag publishes all of it to npm.
set -euo pipefail

cd "$(dirname "$0")/.."

test "$(git branch --show-current)" = main || { echo 'ERROR: release from main'; exit 1; }
git diff --quiet HEAD || { echo 'ERROR: commit or stash your changes first'; exit 1; }

git fetch --quiet --tags origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" || {
  echo 'ERROR: local main differs from origin/main. Pull or push first, so you release exactly what is on GitHub'
  exit 1
}

last=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
range=${last:+$last..}HEAD

echo "Commits since ${last:-the first commit} that this release publishes:"
git log --no-merges --format='  %h %an: %s' "$range"

echo
echo 'Changes to build, release and dependency files (review these closely):'
git diff --stat "$range" -- .github tools package.json package-lock.json nx.json 'tsconfig*.json' 'libs/*/*/project.json' 'libs/*/*/package.json' | sed 's/^/  /'

echo
read -r -p 'Release these changes? [y/N] ' answer < /dev/tty
[ "$answer" = y ] || [ "$answer" = Y ] || { echo 'Release cancelled'; exit 1; }
