#!/usr/bin/env bash

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Vercel exposes the previous successful production SHA for ignored build steps.
# Its shallow clone may not contain that object; in that case we must build,
# not fail the deployment before Next.js starts.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  exit 1
fi

git diff --quiet "$BASE" "$HEAD_SHA" -- \
  ':(top)apps/web' \
  ':(top)packages/contracts' \
  ':(top)pnpm-lock.yaml' \
  ':(top)package.json' \
  ':(top)pnpm-workspace.yaml'
