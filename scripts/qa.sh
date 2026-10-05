#!/usr/bin/env bash
# Runs every check a change must pass, one section per tool.
# Passing sections write their output only to the log; failing sections also print it.
set -uo pipefail
cd "$(dirname "$0")/.."

export NO_COLOR=1 FORCE_COLOR=0
bin=node_modules/.bin
log=.qa/qa.log
mkdir -p .qa
: >"$log"
failed=()

section() {
  local name=$1 out start status
  shift
  out=$(mktemp)
  start=$SECONDS
  if "$@" >"$out" 2>&1; then status=PASS; else status=FAIL; fi
  { echo "=== $name: $status"; cat "$out"; echo; } >>"$log"
  echo "$status $name ($((SECONDS - start))s)"
  if [ "$status" = FAIL ]; then
    failed+=("$name")
    cat "$out"
    echo
  fi
  rm -f "$out"
}

section lint "$bin/biome" check --error-on-warnings --colors=off
section typecheck npm run --silent typecheck
section build "$bin/next" build
section unit "$bin/vitest" run
section e2e "$bin/playwright" test

if [ ${#failed[@]} -eq 0 ]; then
  echo "QA PASSED. Full log: $log"
else
  echo "QA FAILED: ${failed[*]}. Full log: $log"
  exit 1
fi
