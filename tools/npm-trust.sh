#!/usr/bin/env bash
# Makes every @onivoro/* package trust .github/workflows/publish.yml in onivoro/monorepo, run in the
# npm-publish environment, so GitHub Actions can publish it with provenance and no npm token.
# Requiring the environment means only runs for v* release tags can publish.
# Then sets each package to require two-factor authentication and disallow tokens (mfa=publish), so a
# leaked npm token can't publish it; trusted publishing still works.
# Run once after `npm login`, and again whenever a new library is added; packages already trusted are skipped.
# Extra arguments go to npm, e.g. --dry-run or --otp=<code>.
set -euo pipefail

REPO=onivoro/monorepo
WORKFLOW=publish.yml
ENVIRONMENT=npm-publish

cd "$(dirname "$0")/.."
npm whoami > /dev/null || { echo 'ERROR: not logged in to npm. Run npm login first'; exit 1; }

dry_run=false
for arg in "$@"; do [ "$arg" = --dry-run ] && dry_run=true; done

for pkg in libs/*/*/package.json; do
  name=$(node -p "require('./$pkg').name")
  # Reading trust needs two-factor authentication too, so a failure here must stop rather than count as untrusted
  trust=$(npm trust list "$name") || { echo "ERROR: couldn't read the trust settings of $name"; exit 1; }
  if grep -q "$WORKFLOW" <<< "$trust"; then
    echo "skip: $name already trusts $WORKFLOW"
  else
    echo "trust: $name"
    npm trust github "$name" --repository "$REPO" --file "$WORKFLOW" --environment "$ENVIRONMENT" --allow-publish --yes "$@"
  fi
  if $dry_run; then
    echo "would set: $name mfa=publish"
  else
    npm access set mfa=publish "$name" "$@"
  fi
done

echo
echo 'Review who can publish or change these packages and their trust settings:'
npm org ls onivoro || true
echo
echo 'Your npm tokens (revoke any you no longer need with npm token revoke <id>):'
npm token list || true
