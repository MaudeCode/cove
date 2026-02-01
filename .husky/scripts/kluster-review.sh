#!/bin/bash
# kluster.ai code review for staged files
# Runs kluster_code_review_auto on all staged source files

set -e

# Get staged files (only .ts, .tsx, .js, .jsx, .css files in src/)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^src/.*\.(ts|tsx|js|jsx|css)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✓ No source files staged, skipping kluster review"
  exit 0
fi

# Convert to absolute paths separated by semicolons
REPO_ROOT=$(git rev-parse --show-toplevel)
FILE_PATHS=""
for file in $STAGED_FILES; do
  if [ -n "$FILE_PATHS" ]; then
    FILE_PATHS="${FILE_PATHS};"
  fi
  FILE_PATHS="${FILE_PATHS}${REPO_ROOT}/${file}"
done

echo "🔍 Running kluster.ai code review on $(echo "$STAGED_FILES" | wc -l | tr -d ' ') file(s)..."

# Run kluster code review via mcporter
RESULT=$(mcporter call kluster.kluster_code_review_auto \
  --config ~/agents/maude/config/mcporter.json \
  modified_files_path="$FILE_PATHS" 2>&1) || {
  echo "⚠️  kluster.ai review failed to run"
  echo "$RESULT"
  # Don't block commit on tool failure, just warn
  exit 0
}

# Check for issues in the response
if echo "$RESULT" | grep -q '"severity":\s*"P[01]"'; then
  echo "❌ kluster.ai found critical issues (P0/P1):"
  echo "$RESULT" | jq -r '.content[0].text // .' 2>/dev/null || echo "$RESULT"
  echo ""
  echo "Fix the issues above or use 'git commit --no-verify' to skip."
  exit 1
elif echo "$RESULT" | grep -q '"severity"'; then
  echo "⚠️  kluster.ai found issues (non-blocking):"
  echo "$RESULT" | jq -r '.content[0].text // .' 2>/dev/null || echo "$RESULT"
  exit 0
else
  echo "✓ kluster.ai review passed"
  exit 0
fi
