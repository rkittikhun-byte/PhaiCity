#!/usr/bin/env bash
# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
#
# ./run.sh <era1..era5|all> [--only a,b] [--closeups]   build the sets (scripts/build.py)
# ./run.sh export [era1 ...]                             write the game's glbs and index (scripts/export_game.py)
cd "$(dirname "$0")"
BLENDER="${BLENDER:-/d/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
script=scripts/build.py
if [ "$1" = export ]; then script=scripts/export_game.py; shift; fi
"$BLENDER" -b --factory-startup --python-exit-code 1 -P "$script" -- "$@" 2>&1 |
  grep -E "BUILT|EXPORT|OVER|MISSING|Error|Traceback|File \"|line [0-9]|Saved:"
exit "${PIPESTATUS[0]}"
