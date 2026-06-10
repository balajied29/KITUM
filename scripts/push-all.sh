#!/usr/bin/env bash
#
# push-all.sh — commit & push the KITUM monorepo AND the standalone Azure
# backend repo (kitum-backend) in one shot.
#
# This machine is the source of truth: backend application code is mirrored
# from KITUM/backend -> kitum-backend before committing, so the Azure
# deployment repo always matches the latest local work. Repo-specific config
# (package.json, deploy/, vercel.json, README, etc.) is intentionally NOT
# synced — only the app code in the SYNC_DIRS list below.
#
# Usage:
#   npm run push:all -- "your commit message"
#
set -euo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "Error: commit message required." >&2
  echo "Usage: npm run push:all -- \"your commit message\"" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_REPO="$(cd "$ROOT/.." && pwd)/kitum-backend"

# App-code directories that are mirrored from KITUM/backend into kitum-backend.
SYNC_DIRS=(src api)

if [ ! -d "$BACKEND_REPO/.git" ]; then
  echo "Error: backend repo not found at $BACKEND_REPO" >&2
  exit 1
fi

# Commit (only if there are changes) and push a single repo.
commit_and_push() {
  local dir="$1" name="$2"
  cd "$dir"
  git add -A
  if git diff --cached --quiet; then
    echo "  [$name] nothing to commit — pushing existing commits."
  else
    git commit -m "$MSG"
    echo "  [$name] committed."
  fi
  git push
  echo "  [$name] pushed."
}

echo "==> Mirroring backend app code into kitum-backend"
for d in "${SYNC_DIRS[@]}"; do
  rsync -a --delete \
    --exclude 'node_modules/' \
    --exclude '.env' --exclude '.env.*' \
    "$ROOT/backend/$d/" "$BACKEND_REPO/$d/"
  echo "  synced backend/$d -> kitum-backend/$d"
done

echo "==> KITUM monorepo"
commit_and_push "$ROOT" "KITUM"

echo "==> kitum-backend (Azure)"
commit_and_push "$BACKEND_REPO" "kitum-backend"

echo "Done. Both repos pushed."
