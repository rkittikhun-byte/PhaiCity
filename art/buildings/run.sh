#!/usr/bin/env bash
# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
#
# ./run.sh <building|era1..era5|eraN_sheet|all> [--force] [--no-sheet]
# Runs scripts/build.py in Blender in the background. Blender's EEVEE sometimes crashes in a background render
# (EXCEPTION_ACCESS_VIOLATION); then it runs again without --force, so what was already built is kept.
cd "$(dirname "$0")"
BLENDER="${BLENDER:-/d/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
run() { "$BLENDER" -b --factory-startup --python-exit-code 1 -P scripts/build.py -- "$@" 2>&1 |
  grep -E "BUILT|SKIP|LOCKED|MISSING|Error|Traceback|File \"|line [0-9]|Saved: .*_sheet|OVER"; return "${PIPESTATUS[0]}"; }
run "$@" && exit 0
echo "--- Blender failed, trying again (keeping what was built)"
args=()
for a in "$@"; do [ "$a" != "--force" ] && args+=("$a"); done
run "${args[@]}"
