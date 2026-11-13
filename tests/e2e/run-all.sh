#!/usr/bin/env bash
# Run every browser suite against a served build (default http://localhost:5144/).
# Usage:  npm run build && PORT=5144 node scripts/serve.mjs &   then   bash tests/e2e/run-all.sh
# Env:    BASE (site URL), CHROME (browser binary), SHOTS (screenshot dir), CI (adds --no-sandbox)
set -u
cd "$(dirname "$0")/../.."
BASE="${BASE:-http://localhost:5144/}"; export BASE
SHOTS="${SHOTS:-e2e-shots}"; mkdir -p "$SHOTS"
NODE="node --no-warnings --experimental-websocket"
fail=0; summary=""

run() {  # name, then the suite's own arguments
  local name="$1"; shift
  echo "::group::$name"
  $NODE "tests/e2e/$name.mjs" "$@" 2>&1 | tee "$SHOTS/$name.log"
  local code=${PIPESTATUS[0]}
  echo "::endgroup::"
  local line; line=$(grep -E "passed, [0-9]+ failed" "$SHOTS/$name.log" | tail -1)
  [ -z "$line" ] && line="(no summary — crashed? exit $code)"
  summary+=$(printf '%-15s %s\n' "$name" "$line")$'\n'
  if [ "$code" -ne 0 ]; then fail=1; grep -E "^✗" "$SHOTS/$name.log" | sed "s/^/  [$name] /"; fi
}

run pages "$BASE"
run transition "$BASE"
run detail "$SHOTS/detail"
run palette "$SHOTS/palette"
run sheet-history "$SHOTS/sheet-history"
run portfolio "$BASE" "$SHOTS/portfolio"
run browse "$SHOTS/browse" "$BASE"
run lists "$SHOTS/lists"

echo; echo "===== summary ====="; printf '%s' "$summary"
exit $fail
