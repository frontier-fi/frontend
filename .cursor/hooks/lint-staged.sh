#!/bin/bash
# Cursor Cloud Agent overrides core.hooksPath, so the repo's husky/lint-staged
# pre-commit never runs on `git commit`. This hook re-applies the same gate:
# run lint-staged on the staged files, then block the commit if it fails.
# lint-staged re-stages its fixes, so the following `git commit` picks them up.
# Send lint-staged to stderr so stdout stays JSON.
#
# Cursor kills this hook if it runs longer than ~60s, but package typechecks
# need several minutes. Allow a matching stamp from a prior successful
# `pnpm lint-staged` for the same index tree (written below or by agents).

# Consume stdin (hook input JSON) so the shell doesn't wait on it.
cat >/dev/null

if git diff --cached --quiet; then
  echo '{"permission": "deny", "user_message": "Stage files in a separate Shell call before git commit.", "agent_message": "Stage files in a separate Shell call before git commit. This hook runs before the command, so lint-staged cannot see files added in the same call."}'
  exit 2
fi

STAMP_DIR=".git"
STAMP_FILE="$STAMP_DIR/lint-staged.stamp"
INDEX_HASH="$(git write-tree)"

if [[ -f "$STAMP_FILE" ]] && [[ "$(cat "$STAMP_FILE")" == "$INDEX_HASH" ]]; then
  echo '{"permission": "allow", "user_message": "lint-staged already verified for this index."}'
  exit 0
fi

# Parallel package typechecks OOM on this monorepo; serialize and raise the heap.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
if pnpm lint-staged --concurrent 1 >&2; then
  # Recompute: lint-staged may have re-staged prettier/eslint fixes.
  git write-tree >"$STAMP_FILE"
  echo '{"permission": "allow"}'
  exit 0
else
  rm -f "$STAMP_FILE"
  echo '{"permission": "deny", "user_message": "lint-staged failed. Fix the reported issues and retry the commit.", "agent_message": "pnpm lint-staged failed. Fix the reported issues, re-stage, and retry git commit."}'
  exit 2
fi
