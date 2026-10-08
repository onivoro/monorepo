#!/usr/bin/env bash
# Makes every @onivoro/* package trust .github/workflows/publish.yml in onivoro/monorepo, run in the
# npm-publish environment, so GitHub Actions can publish it with provenance and no npm token.
# Requiring the environment means only runs for v* release tags can publish.
# Run once after `npm login`, and again whenever a new library is added; packages already set up are skipped.
# Extra arguments go to `npm trust github`, e.g. --dry-run or --otp=<code>.
set -euo pipefail

REPO=onivoro/monorepo
WORKFLOW=publish.yml
ENVIRONMENT=npm-publish

cd "$(dirname "$0")/.."
npm whoami > /dev/null || { echo 'ERROR: not logged in to npm. Run npm login first'; exit 1; }

for pkg in libs/*/*/package.json; do
  name=$(node -p "require('./$pkg').name")
  if npm trust list "$name" 2>/dev/null | grep -q "$WORKFLOW"; then
    echo "skip: $name already trusts $WORKFLOW"
    continue
  fi
  echo "trust: $name"
  npm trust github "$name" --repository "$REPO" --file "$WORKFLOW" --environment "$ENVIRONMENT" --allow-publish --yes "$@"
done
