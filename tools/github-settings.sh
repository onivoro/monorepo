#!/usr/bin/env bash
# GitHub settings for onivoro/monorepo that publishing to npm relies on (see readme.md).
# Safe to run again: it updates what exists and creates what doesn't. Needs `gh` logged in as a repo admin.
set -euo pipefail

ORG=onivoro
R=repos/$ORG/monorepo
ADMIN_ROLE=5 # repository role id for admin, used as the ruleset bypass actor

# Creates or replaces a ruleset by name
ruleset() {
  local name=$1 body=$2 id
  id=$(gh api "$R/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
  if [ -n "$id" ]; then
    echo "$body" | gh api -X PUT "$R/rulesets/$id" --input - --jq '"ruleset updated: "+.name'
  else
    echo "$body" | gh api -X POST "$R/rulesets" --input - --jq '"ruleset created: "+.name'
  fi
}

# npm-publish environment: only v* tags may deploy to it. No reviewer, so a release tag publishes automatically.
echo '{"reviewers":[],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api -X PUT "$R/environments/npm-publish" --input - --jq '"environment: "+.name'
policies=$(gh api "$R/environments/npm-publish/deployment-branch-policies" --jq '.branch_policies[] | "\(.type) \(.name)"')
grep -qx 'tag v\*' <<< "$policies" \
  || gh api -X POST "$R/environments/npm-publish/deployment-branch-policies" -f name='v*' -f type=tag --jq '"environment allows: "+.type+" "+.name'
gh api "$R/environments/npm-publish/deployment-branch-policies" --jq '.branch_policies[] | select(.name != "v*" or .type != "tag") | .id' \
  | while read -r id; do gh api -X DELETE "$R/environments/npm-publish/deployment-branch-policies/$id" && echo "removed environment policy $id"; done

# Only admins can create, move or delete v* tags, so only admins can publish
ruleset 'release tags' '{"name":"release tags","target":"tag","enforcement":"active",
  "bypass_actors":[{"actor_id":'$ADMIN_ROLE',"actor_type":"RepositoryRole","bypass_mode":"always"}],
  "conditions":{"ref_name":{"include":["refs/tags/v*"],"exclude":[]}},
  "rules":[{"type":"creation"},{"type":"update"},{"type":"deletion"}]}'

# main: no deletion or force-push, and changes arrive by pull request with one approval, plus code owner
# review for build and release files (.github/CODEOWNERS). Admins bypass, so release:push can push directly.
ruleset 'main' '{"name":"main","target":"branch","enforcement":"active",
  "bypass_actors":[{"actor_id":'$ADMIN_ROLE',"actor_type":"RepositoryRole","bypass_mode":"always"}],
  "conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},
  "rules":[{"type":"deletion"},{"type":"non_fast_forward"},
    {"type":"pull_request","parameters":{"required_approving_review_count":1,"require_code_owner_review":true,
      "dismiss_stale_reviews_on_push":true,"require_last_push_approval":true,"required_review_thread_resolution":false}}]}'

# Only GitHub-owned actions, pinned to full commit SHAs
gh api -X PUT "$R/actions/permissions" -F enabled=true -f allowed_actions=selected -F sha_pinning_required=true --silent
echo '{"github_owned_allowed":true,"verified_allowed":false,"patterns_allowed":[]}' \
  | gh api -X PUT "$R/actions/permissions/selected-actions" --input - --silent
echo 'actions: GitHub-owned only, SHA pinning required'

# Workflow GITHUB_TOKEN is read-only unless a workflow asks for more
gh api -X PUT "$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false --silent
echo 'workflow token: read-only'

# Secret scanning with push protection, Dependabot alerts and security updates, private vulnerability reporting
echo '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' \
  | gh api -X PATCH "$R" --input - --silent
gh api -X PUT "$R/vulnerability-alerts" --silent
gh api -X PUT "$R/automated-security-fixes" --silent
gh api -X PUT "$R/private-vulnerability-reporting" --silent
echo 'security: secret scanning, push protection, Dependabot alerts and security updates, private vulnerability reporting'

echo
echo 'Repository access (only release owners should be admin):'
gh api "$R/collaborators" --jq '.[] | "  \(.login): \(.role_name)"'
echo
echo "Org 2FA required: $(gh api "orgs/$ORG" --jq .two_factor_requirement_enabled)"
echo "  The API can't change this. Turn it on at https://github.com/organizations/$ORG/settings/security"
