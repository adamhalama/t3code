#!/usr/bin/env bash
# fork: disables every upstream workflow in the fork so only .github/workflows/fork-*.yml run.
# Usage: scripts/fork-disable-upstream-workflows.sh [owner/repo] [--dry-run]
# Upstream workflow files stay untouched so rebases onto upstream never conflict on them.
set -euo pipefail

repo="adamhalama/t3code"
dry_run=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    *) repo="$arg" ;;
  esac
done

# Reusable workflows that fork-*.yml call. They only run through `workflow_call`, so disabling
# them gains nothing and could block the fork's own pipeline.
keep=(".github/workflows/release-desktop.yml")

workflows="$(gh workflow list -R "$repo" --all --limit 500 --json path,state --jq '.[] | "\(.path)\t\(.state)"')"
if [[ -z "$workflows" ]]; then
  echo "GitHub lists no workflows for $repo yet; they appear after a branch with workflow files is pushed."
  exit 0
fi

while IFS=$'\t' read -r path state; do
  name="${path##*/}"
  if [[ "$path" != .github/workflows/* ]]; then
    echo "skip     $path (not a repository workflow file)"
    continue
  fi
  if [[ "$name" == fork-* ]]; then
    echo "keep     $path (fork)"
    continue
  fi
  if [[ " ${keep[*]} " == *" $path "* ]]; then
    echo "keep     $path (called by fork workflows)"
    continue
  fi
  if [[ "$state" != "active" ]]; then
    echo "skip     $path ($state)"
    continue
  fi
  if [[ "$dry_run" == true ]]; then
    echo "would disable $path"
  else
    gh workflow disable "$name" -R "$repo"
    echo "disabled $path"
  fi
done <<< "$workflows"
