#!/usr/bin/env bash
# Makes every @onivoro/* package trust .github/workflows/publish.yml in onivoro/monorepo, run in the
# npm-publish environment, so GitHub Actions can publish it with provenance and no npm token.
# Requiring the environment means only runs for v* release tags can publish.
# Then sets each package to require two-factor authentication and disallow tokens (mfa=publish), so a
# leaked npm token can't publish it; trusted publishing still works.
# Run once after `npm login`, and again whenever a new library is added; packages already trusted are skipped.
#
# A new trust expires unless a publish uses it within about 48 hours, and `npm trust list` doesn't show that
# it expired (the package's settings page on npmjs.com does). CI then fails with "OIDC token exchange error -
# package not found". --renew replaces each package's trust of the workflow with a new one; release right after.
#
#   bash tools/npm-trust.sh                            # every package in libs/
#   bash tools/npm-trust.sh @onivoro/server-foo        # only the packages named
#   bash tools/npm-trust.sh --renew                    # replace expired trust
#
# Other arguments starting with - go to npm, e.g. --dry-run or --otp=<code>.
set -euo pipefail

REPO=onivoro/monorepo
WORKFLOW=publish.yml
ENVIRONMENT=npm-publish

cd "$(dirname "$0")/.."
npm whoami > /dev/null || { echo 'ERROR: not logged in to npm. Run npm login first'; exit 1; }
[ -t 0 ] && [ -t 1 ] || { echo 'ERROR: run this in an interactive terminal, so npm can ask for two-factor authentication'; exit 1; }

log=$(mktemp)
trap 'rm -f "$log"' EXIT

list_trust() {
  if [ "$(uname)" = Darwin ]; then
    script -q "$2" npm trust list "$1"
  else
    script -q -e -c "npm trust list '$1'" "$2"
  fi
}

# Prints the id of each entry in a recorded `npm trust list` that trusts $WORKFLOW
trust_ids() {
  tr -d '\r' < "$1" | awk -v file="$WORKFLOW" -v RS= '$0 ~ "file: " file "(\n|$)" { match($0, /id: [^\n]+/); print substr($0, RSTART + 4, RLENGTH - 4) }'
}

dry_run=false
renew=false
names=()
flags=()
for arg in "$@"; do
  case $arg in
    --renew) renew=true ;;
    --dry-run) dry_run=true; flags+=("$arg") ;;
    -*) flags+=("$arg") ;;
    *) names+=("$arg") ;;
  esac
done
if [ ${#names[@]} -eq 0 ]; then
  for pkg in libs/*/*/package.json; do names+=("$(node -p "require('./$pkg').name")"); done
fi

for name in "${names[@]}"; do
  # Reading trust needs two-factor authentication too, so a failure here must stop rather than count as untrusted.
  # npm only asks for it when stdin and stdout are a terminal, so run it under `script`, which gives it one,
  # shows its prompts and records its output for the check below
  list_trust "$name" "$log" || { echo "ERROR: couldn't read the trust settings of $name"; exit 1; }
  if $renew; then
    for id in $(trust_ids "$log"); do
      if $dry_run; then
        echo "would revoke: $name trust $id"
      else
        echo "revoke: $name trust $id"
        npm trust revoke "$name" --id="$id" ${flags[@]+"${flags[@]}"}
      fi
    done
    : > "$log"
  fi
  if grep -q "$WORKFLOW" "$log"; then
    echo "skip: $name already trusts $WORKFLOW"
  else
    echo "trust: $name"
    npm trust github "$name" --repository "$REPO" --file "$WORKFLOW" --environment "$ENVIRONMENT" --allow-publish --yes ${flags[@]+"${flags[@]}"}
  fi
  if $dry_run; then
    echo "would set: $name mfa=publish"
  else
    npm access set mfa=publish "$name" ${flags[@]+"${flags[@]}"}
  fi
done

echo
echo 'Review who can publish or change these packages and their trust settings:'
npm org ls onivoro || true
echo
echo 'Your npm tokens (revoke any you no longer need with npm token revoke <id>):'
npm token list || true
