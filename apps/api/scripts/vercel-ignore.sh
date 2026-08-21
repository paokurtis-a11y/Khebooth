#!/usr/bin/env bash

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Vercel may evaluate ignored builds from a shallow clone that does not
# contain the previous production commit. Missing history must trigger a build
# instead of failing the deployment before NestJS starts.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  exit 1
fi

git diff --quiet "$BASE" "$HEAD_SHA" -- \
  ':(top)apps/api' \
  ':(top)packages/contracts' \
  ':(top)pnpm-lock.yaml' \
  ':(top)package.json' \
  ':(top)pnpm-workspace.yaml'
