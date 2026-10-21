#!/usr/bin/env bash
# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
#
# ./art/icon/run.sh: renders the icon in Blender in the background (icon_1024.png and phaicity_icon.blend, then the
# small sizes' icon_small_1024.png), then writes favicon.ico, assets/icons/app/ and manifest.webmanifest.
cd "$(dirname "$0")/../.."
BLENDER="${BLENDER:-/d/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
render() { "$BLENDER" -b --factory-startup --python-exit-code 1 -P art/icon/build_icon.py -- "$@" 2>&1 |
  grep -E "ICON|Error|Traceback|File \"|line [0-9]"; return "${PIPESTATUS[0]}"; }
render --out art/icon/icon_1024.png --blend art/icon/phaicity_icon.blend &&
  render --small --out art/icon/icon_small_1024.png &&
  node scripts/icon/export.mjs
