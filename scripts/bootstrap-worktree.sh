#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-worktree.sh [source-worktree]

Run this from a newly-created worktree. It copies required ignored local files
from the source worktree, then installs dependencies for the current worktree.

By default, only .env.local is copied. To copy additional ignored paths, set
COVE_WORKTREE_COPY to a colon-separated list, for example:
  COVE_WORKTREE_COPY=".env.local:.env.development.local" scripts/bootstrap-worktree.sh ../cove
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

target_root="$(git rev-parse --show-toplevel)"
source_root="${1:-}"

if [[ -z "$source_root" ]]; then
  current_worktree="$target_root"
  candidate_worktree=""
  candidate_branch=""

  while IFS= read -r line; do
    if [[ "$line" == worktree\ * ]]; then
      candidate_worktree="${line#worktree }"
      candidate_branch=""
    elif [[ "$line" == branch\ * ]]; then
      candidate_branch="${line#branch }"
    elif [[ -z "$line" ]]; then
      if [[ "$candidate_worktree" != "$current_worktree" && "$candidate_branch" == "refs/heads/main" ]]; then
        source_root="$candidate_worktree"
        break
      fi
    fi
  done < <(git worktree list --porcelain && printf '\n')
fi

copy_path() {
  local rel_path="$1"
  local src="$source_root/$rel_path"
  local dest="$target_root/$rel_path"

  if [[ -z "$source_root" || ! -e "$src" ]]; then
    return 0
  fi

  if ! git -C "$target_root" check-ignore -q -- "$rel_path"; then
    echo "skip $rel_path (not ignored by git)"
    return 0
  fi

  if [[ -e "$dest" ]]; then
    echo "skip $rel_path (already exists)"
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  cp -R "$src" "$dest"
  echo "copied $rel_path"
}

if [[ -n "$source_root" ]]; then
  if [[ ! -d "$source_root" ]]; then
    echo "source worktree does not exist: $source_root" >&2
    exit 1
  fi
  source_root="$(cd "$source_root" && pwd)"
fi

copy_list="${COVE_WORKTREE_COPY:-.env.local}"
IFS=':' read -r -a paths_to_copy <<< "$copy_list"
for rel_path in "${paths_to_copy[@]}"; do
  [[ -n "$rel_path" ]] && copy_path "$rel_path"
done

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to install dependencies" >&2
  exit 1
fi

bun install --frozen-lockfile
